from flask import Flask,render_template,request
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager,UserMixin
from werkzeug.security import generate_password_hash,check_password_hash


app=Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"]="sqlite:///app.db"
app.config["SECRET_KEY"]="password"
login_manager=LoginManager(app)
login_manager.login_view='login'
db=SQLAlchemy(app)


class User(db.Model,UserMixin):
    id=db.Column(db.Integer,primary_key=True)
    name=db.Column(db.String)
    group=db.Column(db.String)
    ads=db.relationship("Ad")
    email=db.Column(db.String)
    password=db.Column(db.String)


class Ad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author=db.Column(db.Integer,db.ForeignKey("user.id"))
    goal=db.Column(db.String)
    text=db.Column(db.Text)

@app.route("/")
def main():
    return render_template("main.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/register")
def register():
    if request.method=="POST":
        email=request.form.get("email")
        password=request.form.get("password")
        user=User(email=email,
                  password=generate_password_hash(password)
                  )
        db.session.add(user)
        db.session.commit()
    return render_template("register.html")


@app.route("/ads")
def ads():
    return render_template("ads.html")


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User,int(user_id))

if __name__=="__main__":
    app.run()
