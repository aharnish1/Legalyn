const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const resp = require('../utils/responseHelper');

const registerUser = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return resp.badRequest(res, 'Name, email and password are required');
    }

    if (password.length < 6) {
      return resp.badRequest(res, 'Password must be at least 6 characters');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return resp.badRequest(res, 'User already exists');
    }

    const user = await User.create({ name, email, password });
    if (!user) {
      return resp.badRequest(res, 'Invalid user data');
    }

    resp.created(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id)
    }, 'User registered successfully');
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { email, password } = body;

    if (!email || !password) {
      return resp.badRequest(res, 'Email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return resp.unauthorized(res, 'Invalid email or password');
    }

    resp.success(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id)
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return resp.notFound(res, 'User not found');
    }

    resp.success(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getUserProfile };
