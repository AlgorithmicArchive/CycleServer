const mongoose = require("mongoose");

const cycleSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the Users collection
      required: true,
    },
    startDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    startMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    startYear: {
      type: Number,
      required: true,
    },
    endDay: {
      type: Number,
      min: 1,
      max: 31,
      default: null, // Allow null by default
    },
    endMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null, // Allow null by default
    },
    endYear: {
      type: Number,
      default: null, // Allow null by default
    },
    afterDays: {
      type: Number,
      required: true,
    },
  },
  {
    collection: "cycle", // Explicitly set the collection name
  }
);

module.exports = mongoose.model("Cycle", cycleSchema);
