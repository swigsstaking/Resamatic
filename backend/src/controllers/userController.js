import User from '../models/User.js';

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().populate('assignedSites', 'name slug domain').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('assignedSites', 'name slug domain');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, name, password, role, assignedSites } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name and password required' });
    }
    const user = await User.create({
      email,
      name,
      passwordHash: password,
      role: role || 'client',
      assignedSites: assignedSites || [],
    });
    const populated = await User.findById(user._id).populate('assignedSites', 'name slug domain');
    res.status(201).json({ user: populated });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, role, assignedSites, isActive } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (assignedSites !== undefined) user.assignedSites = assignedSites;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    const populated = await User.findById(user._id).populate('assignedSites', 'name slug domain');
    res.json({ user: populated });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Email already exists' });
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password required' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.passwordHash = newPassword;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
};
