var express = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const Users = require("../models/Users");
const Cycle = require("../models/Cycle");
const { default: mongoose } = require("mongoose");
var router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.get("/userdetails", authenticateToken, async (req, res) => {
  try {
    // Find the user by ID
    const user = await Users.findById(req.userId).select("-password"); // Exclude the password field

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user); // Return the user details
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/latest-cycle", authenticateToken, async (req, res) => {
  try {
    const id = `${req.userId}`;

    if (mongoose.Types.ObjectId.isValid(id)) {
      const latestCycle = await Cycle.findOne({
        user_id: new mongoose.Types.ObjectId(id),
      })
        .sort({ endYear: -1, endMonth: -1 }) // Sort by endYear first, then by endMonth
        .select("-_id -user_id") // Exclude the _id field
        .exec();

      if (!latestCycle) {
        return res.status(200).json(null);
      }

      res.json(latestCycle);
    } else {
      res.status(400).json({ message: "Invalid ObjectId" });
    }
  } catch (err) {
    console.error("Error fetching latest cycle:", err);
    res.status(500).json({ message: "Server error." });
  }
});

router.post("/start-cycle", authenticateToken, async (req, res) => {
  try {
    const { startDay, startMonth, startYear } = req.body; // Extract input data
    const userId = req.userId; // Get user ID from token

    if (!startDay || !startMonth || !startYear) {
      return res
        .status(400)
        .json({ error: "startDay, startMonth, and startYear are required." });
    }

    // Validate the ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    // Find the latest cycle for the user
    const latestCycle = await Cycle.findOne({ user_id: userId })
      .sort({ endYear: -1, endMonth: -1, endDay: -1 }) // Sort by endYear, endMonth, endDay descending
      .exec();

    let afterDays = 0;

    if (latestCycle) {
      // Calculate the difference in days
      const latestEndDate = new Date(
        latestCycle.endYear,
        latestCycle.endMonth - 1,
        latestCycle.endDay
      );
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const timeDifference = startDate - latestEndDate; // Time difference in milliseconds
      afterDays = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)); // Convert milliseconds to days
    }

    // Create the new cycle record
    const newCycle = new Cycle({
      user_id: userId,
      startDay,
      startMonth,
      startYear,
      afterDays,
    });

    // Save the new cycle to the database
    await newCycle.save();

    // Update the user's isCycle property to true
    await Users.findByIdAndUpdate(userId, { isCycle: true });

    res.status(201).json({
      message: "Cycle started successfully.",
    });
  } catch (err) {
    console.error("Error starting cycle:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/end-cycle", authenticateToken, async (req, res) => {
  try {
    const { endDay, endMonth, endYear } = req.body; // Extract input data
    const userId = req.userId; // Get user ID from token

    if (!endDay || !endMonth || !endYear) {
      return res
        .status(400)
        .json({ error: "endDay, endMonth, and endYear are required." });
    }

    // Validate the ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    // Find the latest cycle for the user that doesn't have an end date
    const latestCycle = await Cycle.findOne({
      user_id: userId,
      endDay: null, // Check for cycles that have not been ended
      endMonth: null,
      endYear: null,
    }).sort({ startYear: -1, startMonth: -1, startDay: -1 });

    if (!latestCycle) {
      return res.status(404).json({ error: "No active cycle found to end." });
    }

    // Update the cycle with the end date
    latestCycle.endDay = endDay;
    latestCycle.endMonth = endMonth;
    latestCycle.endYear = endYear;
    await latestCycle.save();

    // Update the user's isCycle property to false
    await Users.findByIdAndUpdate(userId, { isCycle: false });

    res.status(200).json({
      message: "Cycle ended successfully.",
    });
  } catch (err) {
    console.error("Error ending cycle:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/add-multiple", authenticateToken, async (req, res) => {
  const { cycles } = req.body; // Directly access cycles from req.body
  const user_id = req.userId; // Assuming authenticateToken attaches userId to req

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  if (!Array.isArray(cycles)) {
    return res.status(400).json({ error: "Cycles should be an array" });
  }

  try {
    for (const cycle of cycles) {
      const { startDay, startMonth, startYear } = cycle;

      // Determine the previous month and year
      let prevMonth = startMonth - 1;
      let prevYear = startYear;

      if (prevMonth === 0) {
        prevMonth = 12; // December
        prevYear -= 1; // Previous year
      }

      // Find the most recent record for the same user, previous month, and year
      const previousRecord = await Cycle.findOne({
        user_id, // Match user_id
        endMonth: prevMonth,
        endYear: prevYear,
      })
        .sort({ endDay: -1 }) // Sort by endDay in descending order to get the latest
        .exec();

      if (previousRecord) {
        const prevEndDate = new Date(
          previousRecord.endYear,
          previousRecord.endMonth - 1,
          previousRecord.endDay
        );
        const currStartDate = new Date(startYear, startMonth - 1, startDay);

        // Calculate difference in days
        const timeDiff = currStartDate - prevEndDate; // Difference in milliseconds
        const afterDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Convert to days

        cycle.afterDays = afterDays; // Add afterDays to the current cycle
      } else {
        cycle.afterDays = 0; // No previous record found, set afterDays to 0
      }

      cycle.user_id = user_id; // Attach user_id to each cycle
    }

    // Insert cycles into the collection
    await Cycle.insertMany(cycles);

    res.status(201).json({ message: "Cycles added successfully", cycles });
  } catch (error) {
    console.error("Error adding cycles:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
