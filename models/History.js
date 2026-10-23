
const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  expression: {
    type: String,
    required: true,
    maxlength: 500
  },
  result: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("History", historySchema);
