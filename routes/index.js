var express = require("express");
var router = express.Router();
const Users = require("../models/Users"); // Ensure this is the correct path to your User model
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

/* POST /add-user */
router.post("/add-user", async (req, res) => {
  try {
    const { username, email, password, isCycle } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new Users({
      username,
      email,
      password: hashedPassword,
      isCycle: isCycle || false,
      createdAT: new Date(),
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      message: "User added successfully",
      user: savedUser,
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res
      .status(500)
      .json({ message: "Failed to add user", error: error.message });
  }
});

/* POST /login */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required." });
    }

    const user = await Users.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password." });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      username: user.username,
      isCycle: user.isCycle,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
});

module.exports = router;
