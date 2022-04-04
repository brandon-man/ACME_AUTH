require("dotenv").config();
const bcrypt = require("bcrypt");
const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const config = {
  logging: false,
};
const jwt = require("jsonwebtoken");

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

const Note = conn.define("note", {
  text: STRING,
});

User.byToken = async (token) => {
  try {
    const verifiedToken = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(verifiedToken.userId);
    if (user) {
      return user;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  const match = await bcrypt.compare(password, user.password);
  if (match) {
    return jwt.sign({ userId: user.id }, process.env.JWT);
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];

  const notes = [
    { text: "hello", userId: 1 },
    { text: "world", userId: 2 },
    { text: "computer", userId: 3 },
  ];

  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );

  const [hello, world, computer] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      hello,
      world,
      computer,
    },
  };
};

User.beforeCreate(async (user, options) => {
  const saltRounds = 10;
  const myPlaintextPassword = user.password;
  const hashed = await bcrypt.hash(myPlaintextPassword, saltRounds);
  user.password = hashed;
});

User.hasMany(Note);
Note.belongsTo(User);

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
