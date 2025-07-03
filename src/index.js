const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const path = require("node:path");
const { connect, model } = require("mongoose");
const UserSchema = require("./Schemas/UserSchema");
require("dotenv").config();

// Passport
const initializePassport = require("./passport-config");
const products = require("./products");
initializePassport(
  passport,
  async (email) => {
    const userCollection = new model("users", UserSchema);
    return await userCollection.findOne({ email: email });
  },
  async (id) => {
    const userCollection = new model("users", UserSchema);
    return await userCollection.findOne({ _id: id });
  }
);

// Env
const PORT = process.env.PORT || 3000;

// Mongo start
connect(process.env.MONGO_DB);
console.log("Connected to the db");

// Express middleware
app.set("views", path.join(__dirname, "views"));
app.set("view-engine", "ejs");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// Server
app.get("/", async (req, res) => {
  const name = req.user ? req.user.displayName : "";
  const toView = req.query.category
    ? req.query.category === "All"
      ? products
      : products.filter((product) => product.category === req.query.category)
    : req.query.search
    ? products.filter(
        (product) =>
          product.title.toLowerCase() === req.query.search.toLowerCase() ||
          product.title
            .toLowerCase()
            .includes(req.query.search.toLowerCase()) ||
          product.productId === parseInt(req.query.search)
      )
    : products;

  res.render("index.ejs", {
    isAuthenticated: req.isAuthenticated(),
    products,
    toView,
    name,
  });
});

// Cart
app.get("/cart", checkAuthenticated, async (req, res) => {
  const cart =
    req.user.cart && req.user.cart[0]
      ? req.user.cart.map(
          (product) => products.filter((item) => item.productId === product)[0]
        )
      : null;
  const name = req.user ? req.user.displayName : "";
  let total = 0;
  if (cart) cart.map((item) => (total += item.price));

  res.render("cart.ejs", {
    isAuthenticated: req.isAuthenticated(),
    products,
    total: total.toFixed(2),
    cart,
    name,
  });
});
app.post("/cart", checkAuthenticated, async (req, res) => {
  const userCollection = new model("users", UserSchema);

  if (req.body.type === "add") {
    await userCollection.updateOne(
      { _id: req.user._id },
      { $push: { cart: parseInt(req.body.productId) } }
    );
  } else if (req.body.type === "remove") {
    await userCollection.updateOne(
      { _id: req.user._id },
      { $pull: { cart: parseInt(req.body.productId) } }
    );
  }
  const user = await userCollection.findOne({ _id: req.user._id });
  req.user.cart = user.cart;

  res.redirect("/cart");
});

// Auth
app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});
app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    // Crypt password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Store in db
    const userCollection = new model("users", UserSchema);

    // Check email
    const profile = await userCollection.findOne({ email: req.body.email });
    if (profile) {
      req.flash("error", "Account already exists.");
      return res.redirect("/register");
    }

    const data = new userCollection({
      displayName: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      cart: [],
      provider: "web",
    });
    data.save();
    return res.redirect("/login");
  } catch (error) {
    // Manage error
    console.log(error);
    res.redirect("/register");
  }
});

app.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/api/vi/oauth/google",
  passport.authenticate("google", {
    failureRedirect: "/auth/error",
    successRedirect: "/auth/success",
  })
);

app.get("/auth/error", checkAuthenticated, (req, res) => {
  res.redirect("/");
});
app.get("/auth/success", checkAuthenticated, (req, res) => {
  res.redirect("/");
});

// LogOut
app.delete("/logout", checkAuthenticated, (req, res) => {
  req.logOut((err) => {
    if (err) {
      console.error(err);
      return next(err);
    }
    res.redirect("/");
  });
});

// Middleware
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();

  res.redirect("/login");
}
function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return res.redirect("/");

  next();
}

app.listen(PORT, () => {
  console.log(`Running on ${PORT} port`);
});
