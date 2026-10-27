"""
Веб-приложение «Поиск учебных партнёров» — BACKEND (Flask).

Как это устроено:
  * Flask отдаёт только JSON (REST API, все адреса начинаются с /api).
  * Интерфейс — отдельное React-приложение (папка frontend), оно ходит в этот API.
  * Авторизация — сессии Flask-Login (cookie). Браузер сам хранит и отправляет cookie.
  * База данных — SQLite (файл instance/app.db), работа с ней через SQLAlchemy.

Запуск:  python app.py   (сервер на http://127.0.0.1:5000)
"""
import os
import re
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import (LoginManager, UserMixin, current_user, login_required,
                         login_user, logout_user)
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, select
from werkzeug.security import check_password_hash, generate_password_hash

# ----------------------------------------------------------------------------
# 1. НАСТРОЙКА ПРИЛОЖЕНИЯ
# ----------------------------------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"   # файл instance/app.db
# Секретный ключ подписывает cookie сессии. В реальном проекте задаётся через
# переменную окружения SECRET_KEY, а не хранится в коде.
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")

db = SQLAlchemy(app)
migrate = Migrate(app, db)            # оставлено из вашего проекта (команды flask db ...)
login_manager = LoginManager(app)

# CORS нужен, если открывать React не через прокси Vite, а напрямую.
# supports_credentials=True разрешает браузеру отправлять cookie сессии.
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"],
     supports_credentials=True)

# Категории объявлений (используются и в фильтре, и при создании объявления)
CATEGORIES = ["Математика", "Информатика", "Физика", "Олимпиады", "Хакатоны",
              "Групповой проект", "Подготовка к экзаменам", "Другое"]

ADS_DEFAULT_DAYS = 14          # сколько дней объявление считается актуальным
ADS_MAX_PER_HOUR = 5           # защита от спама: не больше N объявлений в час

# Данные администратора, который создаётся автоматически при первом запуске.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")   # СМЕНИТЕ для реального использования


# ----------------------------------------------------------------------------
# 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ----------------------------------------------------------------------------
def now():
    """Текущее время UTC без tzinfo (так его удобно хранить в SQLite)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    """datetime -> строка ISO с 'Z' (признак UTC). React сам переведёт в местное время."""
    return dt.isoformat() + "Z" if dt else None


def error(message, code=400):
    """Единый формат ошибки: {"error": "..."} + HTTP-код."""
    return jsonify({"error": message}), code


def admin_required(view):
    """Декоратор: пускает только администратора (обязательно ставить ПОСЛЕ @app.route)."""
    @wraps(view)
    @login_required
    def wrapper(*args, **kwargs):
        if not current_user.is_admin:
            return error("Нужны права администратора", 403)
        return view(*args, **kwargs)
    return wrapper


# ----------------------------------------------------------------------------
# 3. МОДЕЛИ БАЗЫ ДАННЫХ
# ----------------------------------------------------------------------------
class User(db.Model, UserMixin):
    """Пользователь + его профиль (учебные интересы, предметы, цели)."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    group = db.Column(db.String(50))                  # класс / группа
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)   # ХЭШ пароля, не сам пароль
    interests = db.Column(db.Text, default="")        # учебные интересы
    subjects = db.Column(db.Text, default="")         # предметы
    goals = db.Column(db.Text, default="")            # цели обучения
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_blocked = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=now)
    ads = db.relationship("Ad", back_populates="author_user", cascade="all, delete-orphan")

    def display_name(self):
        return self.name or self.email.split("@")[0]

    def public(self):
        """Что видят ДРУГИЕ пользователи (без email)."""
        return {"id": self.id, "name": self.display_name(), "group": self.group,
                "interests": self.interests, "subjects": self.subjects, "goals": self.goals}

    def private(self):
        """Что видит сам пользователь (и админ)."""
        data = self.public()
        data.update({"email": self.email, "is_admin": self.is_admin,
                     "is_blocked": self.is_blocked, "created_at": iso(self.created_at)})
        return data


class Ad(db.Model):
    """Объявление о поиске учебной пары / партнёра."""
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    goal = db.Column(db.String(120))                  # заголовок / цель
    text = db.Column(db.Text)                         # описание
    category = db.Column(db.String(50), default="Другое")
    creation_date = db.Column(db.DateTime, default=now)
    expires_at = db.Column(db.DateTime)               # после этой даты объявление неактуально
    is_active = db.Column(db.Boolean, default=True, nullable=False)   # False = закрыто/истекло
    is_hidden = db.Column(db.Boolean, default=False, nullable=False)  # True = скрыто модератором
    author_user = db.relationship("User", back_populates="ads")
    chats = db.relationship("Chat", back_populates="ad", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "goal": self.goal, "text": self.text,
                "category": self.category, "creation_date": iso(self.creation_date),
                "expires_at": iso(self.expires_at), "is_active": self.is_active,
                "is_hidden": self.is_hidden, "author_user": self.author_user.public()}


class Chat(db.Model):
    """Чат создаётся, когда пользователь откликается на объявление.
    Участников двое: автор объявления и откликнувшийся."""
    id = db.Column(db.Integer, primary_key=True)
    ad_id = db.Column(db.Integer, db.ForeignKey("ad.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    responder_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=now)
    ad = db.relationship("Ad", back_populates="chats")
    author_user = db.relationship("User", foreign_keys=[author_id])
    responder_user = db.relationship("User", foreign_keys=[responder_id])
    messages = db.relationship("Message", back_populates="chat",
                               cascade="all, delete-orphan", order_by="Message.id")
    # на одно объявление один человек может откликнуться только один раз
    __table_args__ = (db.UniqueConstraint("ad_id", "responder_id"),)


class Message(db.Model):
    """Одно сообщение в чате."""
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey("chat.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=now)
    chat = db.relationship("Chat", back_populates="messages")

    def to_dict(self):
        return {"id": self.id, "sender_id": self.sender_id, "text": self.text,
                "created_at": iso(self.created_at)}


# ----------------------------------------------------------------------------
# 4. АВТОРИЗАЦИЯ (Flask-Login)
# ----------------------------------------------------------------------------
@login_manager.user_loader
def load_user(user_id):
    """Flask-Login вызывает это на каждом запросе: по id из cookie достаёт пользователя."""
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    """Для API вместо редиректа на /login возвращаем JSON с кодом 401."""
    return error("Нужно войти в аккаунт", 401)


@app.before_request
def drop_blocked_users():
    """Если админ заблокировал пользователя — его сессия сразу сбрасывается."""
    if current_user.is_authenticated and current_user.is_blocked:
        logout_user()


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    group = (data.get("group") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return error("Укажите имя")
    if not EMAIL_RE.match(email):
        return error("Некорректный email")
    if len(password) < 6:
        return error("Пароль должен быть не короче 6 символов")
    if db.session.scalar(select(User).where(User.email == email)):
        return error("Аккаунт с таким email уже существует", 409)

    user = User(name=name, group=group, email=email,
                password=generate_password_hash(password))   # пароль храним только в виде хэша
    db.session.add(user)
    db.session.commit()
    login_user(user)                                          # сразу входим после регистрации
    return jsonify({"user": user.private()}), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.session.scalar(select(User).where(User.email == email))
    if not user:
        return error("Аккаунта не существует", 401)
    if not check_password_hash(user.password, password):
        return error("Неверный пароль", 401)
    if user.is_blocked:
        return error("Аккаунт заблокирован администратором", 403)
    login_user(user, remember=True)
    return jsonify({"user": user.private()})


@app.post("/api/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    """React вызывает это при загрузке страницы, чтобы узнать, вошёл ли пользователь."""
    return jsonify({"user": current_user.private() if current_user.is_authenticated else None})


@app.put("/api/profile")
@login_required
def update_profile():
    """Редактирование профиля: имя, группа, интересы, предметы, цели."""
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return error("Имя не может быть пустым")
    current_user.name = name
    current_user.group = (data.get("group") or "").strip()
    current_user.interests = (data.get("interests") or "").strip()
    current_user.subjects = (data.get("subjects") or "").strip()
    current_user.goals = (data.get("goals") or "").strip()
    db.session.commit()
    return jsonify({"user": current_user.private()})


# ----------------------------------------------------------------------------
# 5. ОБЪЯВЛЕНИЯ
# ----------------------------------------------------------------------------
def expire_old_ads():
    """Автоматическая проверка актуальности: всё, у чего истёк срок, помечаем неактивным.
    Вызывается при каждом запросе списка объявлений, так что отдельный планировщик не нужен."""
    expired = db.session.scalars(
        select(Ad).where(Ad.is_active.is_(True), Ad.expires_at < now())).all()
    for ad in expired:
        ad.is_active = False
    if expired:
        db.session.commit()


def parse_date(value):
    """'2026-06-24' -> datetime, а при ошибке None."""
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


@app.get("/api/categories")
def categories():
    return jsonify(CATEGORIES)


@app.get("/api/ads")
def list_ads():
    """Лента объявлений. Фильтры (все необязательны), передаются в строке запроса:
       ?category=Математика &date_from=2026-06-01 &date_to=2026-06-30 &q=текст &sort=old"""
    expire_old_ads()
    query = select(Ad).where(Ad.is_active.is_(True), Ad.is_hidden.is_(False))

    category = request.args.get("category")
    if category:
        query = query.where(Ad.category == category)

    date_from = parse_date(request.args.get("date_from"))
    if date_from:
        query = query.where(Ad.creation_date >= date_from)

    date_to = parse_date(request.args.get("date_to"))
    if date_to:   # «по 30 июня» включает весь день 30 июня
        query = query.where(Ad.creation_date < date_to + timedelta(days=1))

    text = (request.args.get("q") or "").strip()
    if text:
        like = f"%{text}%"
        query = query.where(or_(Ad.goal.ilike(like), Ad.text.ilike(like)))

    order = Ad.creation_date.asc() if request.args.get("sort") == "old" else Ad.creation_date.desc()
    ads = db.session.scalars(query.order_by(order)).all()
    return jsonify([ad.to_dict() for ad in ads])


@app.post("/api/ads")
@login_required
def create_ad():
    data = request.get_json(silent=True) or {}
    goal = (data.get("goal") or "").strip()
    text = (data.get("text") or "").strip()
    category = data.get("category") or "Другое"
    try:
        days = int(data.get("days") or ADS_DEFAULT_DAYS)
    except (TypeError, ValueError):
        days = ADS_DEFAULT_DAYS

    if not 3 <= len(goal) <= 120:
        return error("Цель: от 3 до 120 символов")
    if not 10 <= len(text) <= 2000:
        return error("Описание: от 10 до 2000 символов")
    if category not in CATEGORIES:
        return error("Неизвестная категория")
    days = max(1, min(days, 60))

    # Антиспам: считаем, сколько объявлений пользователь создал за последний час
    recent = db.session.scalars(select(Ad).where(
        Ad.author == current_user.id, Ad.creation_date > now() - timedelta(hours=1))).all()
    if len(recent) >= ADS_MAX_PER_HOUR:
        return error("Слишком много объявлений за час, попробуйте позже", 429)

    ad = Ad(author=current_user.id, goal=goal, text=text, category=category,
            creation_date=now(), expires_at=now() + timedelta(days=days))
    db.session.add(ad)
    db.session.commit()
    return jsonify(ad.to_dict()), 201


@app.get("/api/my/ads")
@login_required
def my_ads():
    """Личный кабинет: все мои объявления, включая закрытые и истёкшие."""
    expire_old_ads()
    ads = db.session.scalars(select(Ad).where(Ad.author == current_user.id)
                             .order_by(Ad.creation_date.desc())).all()
    return jsonify([ad.to_dict() for ad in ads])


def get_own_ad(ad_id):
    """Объявление, которым может управлять текущий пользователь (автор или админ)."""
    ad = db.session.get(Ad, ad_id)
    if ad and (ad.author == current_user.id or current_user.is_admin):
        return ad
    return None


@app.post("/api/ads/<int:ad_id>/close")
@login_required
def close_ad(ad_id):
    ad = get_own_ad(ad_id)
    if not ad:
        return error("Объявление не найдено", 404)
    ad.is_active = False
    db.session.commit()
    return jsonify(ad.to_dict())


@app.post("/api/ads/<int:ad_id>/extend")
@login_required
def extend_ad(ad_id):
    """Продлить / заново открыть объявление ещё на N дней."""
    ad = get_own_ad(ad_id)
    if not ad:
        return error("Объявление не найдено", 404)
    data = request.get_json(silent=True) or {}
    try:
        days = max(1, min(int(data.get("days") or ADS_DEFAULT_DAYS), 60))
    except (TypeError, ValueError):
        days = ADS_DEFAULT_DAYS
    ad.is_active = True
    ad.expires_at = now() + timedelta(days=days)
    db.session.commit()
    return jsonify(ad.to_dict())


@app.delete("/api/ads/<int:ad_id>")
@login_required
def delete_ad(ad_id):
    ad = get_own_ad(ad_id)
    if not ad:
        return error("Объявление не найдено", 404)
    db.session.delete(ad)     # чаты и сообщения удалятся каскадом
    db.session.commit()
    return jsonify({"ok": True})


# ----------------------------------------------------------------------------
# 6. ОТКЛИКИ И ВСТРОЕННЫЙ ЧАТ
# ----------------------------------------------------------------------------
@app.post("/api/ads/<int:ad_id>/respond")
@login_required
def respond(ad_id):
    """Отклик на объявление = создание чата (или возврат уже существующего)."""
    ad = db.session.get(Ad, ad_id)
    if not ad or not ad.is_active or ad.is_hidden:
        return error("Объявление недоступно", 404)
    if ad.author == current_user.id:
        return error("Нельзя откликнуться на своё объявление")

    chat = db.session.scalar(select(Chat).where(
        Chat.ad_id == ad.id, Chat.responder_id == current_user.id))
    if not chat:
        chat = Chat(ad_id=ad.id, author_id=ad.author, responder_id=current_user.id)
        db.session.add(chat)
        db.session.flush()            # получаем chat.id до коммита

    text = ((request.get_json(silent=True) or {}).get("message") or "").strip()
    if text:                          # первое сообщение необязательно
        db.session.add(Message(chat_id=chat.id, sender_id=current_user.id, text=text[:2000]))
    db.session.commit()
    return jsonify({"chat_id": chat.id}), 201


def get_my_chat(chat_id):
    """Чат доступен только двум его участникам."""
    chat = db.session.get(Chat, chat_id)
    if chat and current_user.id in (chat.author_id, chat.responder_id):
        return chat
    return None


@app.get("/api/chats")
@login_required
def list_chats():
    """Список моих чатов с собеседником и последним сообщением."""
    chats = db.session.scalars(select(Chat).where(
        or_(Chat.author_id == current_user.id, Chat.responder_id == current_user.id)
    ).order_by(Chat.created_at.desc())).all()
    result = []
    for chat in chats:
        partner = chat.responder_user if chat.author_id == current_user.id else chat.author_user
        last = chat.messages[-1].to_dict() if chat.messages else None
        result.append({"id": chat.id, "ad": {"id": chat.ad.id, "goal": chat.ad.goal},
                       "partner": partner.public(), "last_message": last})
    # чаты с самой свежей перепиской — вверху
    result.sort(key=lambda c: (c["last_message"] or {}).get("created_at") or "", reverse=True)
    return jsonify(result)


@app.get("/api/chats/<int:chat_id>/messages")
@login_required
def get_messages(chat_id):
    """Сообщения чата. ?after=<id> — только новые (React опрашивает это раз в 3 секунды)."""
    chat = get_my_chat(chat_id)
    if not chat:
        return error("Чат не найден", 404)
    after = request.args.get("after", type=int, default=0)
    msgs = db.session.scalars(select(Message).where(
        Message.chat_id == chat.id, Message.id > after).order_by(Message.id)).all()
    return jsonify([m.to_dict() for m in msgs])


@app.post("/api/chats/<int:chat_id>/messages")
@login_required
def send_message(chat_id):
    chat = get_my_chat(chat_id)
    if not chat:
        return error("Чат не найден", 404)
    text = ((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not text:
        return error("Пустое сообщение")
    msg = Message(chat_id=chat.id, sender_id=current_user.id, text=text[:2000])
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ----------------------------------------------------------------------------
# 7. АДМИНИСТРАТОР (модерация)
# ----------------------------------------------------------------------------
@app.get("/api/admin/ads")
@admin_required
def admin_ads():
    """Все объявления, включая скрытые и закрытые."""
    ads = db.session.scalars(select(Ad).order_by(Ad.creation_date.desc())).all()
    return jsonify([ad.to_dict() for ad in ads])


@app.get("/api/admin/users")
@admin_required
def admin_users():
    users = db.session.scalars(select(User).order_by(User.id)).all()
    return jsonify([u.private() for u in users])


@app.post("/api/admin/ads/<int:ad_id>/hide")
@admin_required
def admin_toggle_hide(ad_id):
    """Скрыть объявление из ленты (или вернуть обратно)."""
    ad = db.session.get(Ad, ad_id)
    if not ad:
        return error("Объявление не найдено", 404)
    ad.is_hidden = not ad.is_hidden
    db.session.commit()
    return jsonify(ad.to_dict())


@app.post("/api/admin/users/<int:user_id>/block")
@admin_required
def admin_toggle_block(user_id):
    """Заблокировать нарушителя (или разблокировать)."""
    user = db.session.get(User, user_id)
    if not user:
        return error("Пользователь не найден", 404)
    if user.is_admin:
        return error("Нельзя заблокировать администратора")
    user.is_blocked = not user.is_blocked
    db.session.commit()
    return jsonify(user.private())


# ----------------------------------------------------------------------------
# 8. ЗАПУСК
# ----------------------------------------------------------------------------
@app.get("/")
def index():
    return jsonify({"message": "API работает. Интерфейс: http://localhost:5173"})


def init_db():
    """Создаёт таблицы и (при первом запуске) учётную запись администратора."""
    db.create_all()
    if not db.session.scalar(select(User).where(User.is_admin.is_(True))):
        db.session.add(User(name="Администратор", email=ADMIN_EMAIL, is_admin=True,
                            password=generate_password_hash(ADMIN_PASSWORD)))
        db.session.commit()


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
