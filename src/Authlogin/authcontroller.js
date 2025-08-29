import Donor from "../models/Donor.js";
import Hospital from "../models/Hospital.js";
import Admin from "../models/Admin.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {

    let user =
      (await Admin.findOne({ email })) ||
      (await Donor.findOne({ email })) ||
      (await Hospital.findOne({ email }));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const { password: _, ...userData } = user.toObject();

    res.status(200).json({ ...userData, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};