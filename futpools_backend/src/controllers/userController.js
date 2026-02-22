const ADMIN_EMAIL = 'demo@futpools.app';

exports.getMe = async (req, res) => {
  try {
    const isAdmin = (req.user.email || '').toLowerCase() === ADMIN_EMAIL;
    res.json({
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
      isAdmin,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const { displayName } = req.body;
    if (displayName !== undefined) {
      req.user.displayName = (displayName ?? '').toString().trim();
    }
    await req.user.save();
    res.json({
      id: req.user._id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.displayName,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
