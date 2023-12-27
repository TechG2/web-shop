const { Schema } = require("mongoose");

const UserSchema = new Schema({
  displayName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: false,
  },
  cart: {
    type: Array,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
});

module.exports = UserSchema;
