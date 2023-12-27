const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const bcrypt = require("bcrypt");
const UserSchema = require("./Schemas/UserSchema");
const { model } = require("mongoose");
require("dotenv").config();

async function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    const user = await getUserByEmail(email);
    if (!user) return done(null, false, { message: "No user with that email" });

    try {
      if (await bcrypt.compare(password, user.password))
        return done(null, user);
      else return done(null, false, { message: "Password incorrect" });
    } catch (e) {
      return done(e);
    }
  };

  passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_ID,
        clientSecret: process.env.GOOGLE_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK,
        passReqToCallback: true,
      },
      async (request, accessToken, refreshToken, profile, done) => {
        // Store in db
        const userCollection = new model("users", UserSchema);

        const user = await userCollection.findOne({ email: profile.email });
        if (!user) {
          const data = new userCollection(profile);
          profile._id = data._id;
          profile.cart = data.cart;
          data.save();
        } else {
          profile._id = user._id;
          profile.cart = user.cart;
        }

        done(null, profile);
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser(async (user, done) => {
    return done(null, user);
  });
}

module.exports = initialize;
