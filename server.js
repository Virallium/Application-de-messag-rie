const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const server = http.createServer(app);

const sqlite3 = require("sqlite3").verbose();

const session = require("express-session");

const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "mot-secret-pour-session",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // true si HTTPS
      maxAge: 1000 * 60 * 60, // 1 heure
    },
  }),
);

const db = new sqlite3.Database("./chat.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    return;
  }
  console.log("connection base de données réussie");
});
db.run(
  `
  CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table message est créée avec succès");
  },
);
db.run(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    middlename TEXT,
    number TEXT UNIQUE,
    password TEXT,
    photo TEXT 
  )`, (err) => {
    if (err) console.log("Erreur table users:", err.message);
    else console.log("Table users prête.");
});

io.on("connection", (socket) => {
  console.log("Un utilisateur s'est conncecté ");
  socket.on("chat", (data) => {
    db.run(
      `INSERT INTO messages(username, content) VALUES(?,?)`,
      [data.name, data.message],
      (err) => {
        if (err) {
          console.log(err);
        }
      },
    );
    io.emit("chat", data);
  });
});
app.get("/register", (req, res) => {
  res.render("register",{});
});

app.post("/register", (req, res) => {
  const { lastname, middlename ,number, mdpass , photo} = req.body;

  db.run(
    `INSERT INTO users (username,middlename, number, password, photo) VALUES (?, ?, ?, ?, ?)`,
    [lastname, middlename ,number, mdpass, photo],
    (err) => {
      if (err) {
        console.error(err.message);
        return res.send("Erreur : Ce numéro de téléphone est déjà utilisé. <a href='/register'>Retour</a>");
      }

      res.redirect("/"); 
    }
  );
});
// 1. Route pour afficher la page (sans détruire la session immédiatement)
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/index"); // Si déjà connecté, on entre !
  res.render("login");
});

// 2. Route POST spécifique pour le login
app.post("/login", (req, res) => {
  const { number, mdpass } = req.body;

  db.get(
    `SELECT * FROM users WHERE number = ? AND password = ?`,
    [number, mdpass],
    (err, row) => {
      if (err) {
        console.error(err.message);
        return res.send("Erreur lors de la connexion.");
      }

      if (row) {
        //l'initialisation de la session utilisateur
        req.session.user = {
          id: row.id,
          username: row.username,
          number: row.number,
          role: "user"
        };
        // On attend que la session soit sauvegardée avant de rediriger
        req.session.save(() => {
          res.redirect("/index");
        });
      } else {
        res.send("Identifiants incorrects. <a href='/'>Réessayer</a>");
      }
    }
  );
});
app.get("/archive", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  
  // Récupérer le profil complet
  db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, userProfile) => {
    if (err || !userProfile) {
      userProfile = req.session.user;
    }

    // Récupérer tous les messages
    db.all(
      "SELECT * FROM messages ORDER BY created_at DESC", 
      [], 
      (err, messages) => {
        res.render("archive", { 
          user: req.session.user,
          userProfile: userProfile,
          messages: messages || []
        });
      }
    );
  });
});

app.get("/profil", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  
  db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, userProfile) => {
    if (err || !userProfile) {
      return res.render("profil", {
        user: req.session.user,
        userProfile: req.session.user
      });
    }

    res.render("profil", {
      user: req.session.user,
      userProfile: userProfile
    });
  });
});

app.get("/groupe", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  
  db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, userProfile) => {
    if (err || !userProfile) {
      userProfile = req.session.user;
    }

    // Récupérer tous les utilisateurs pour les afficher comme membres
    db.all("SELECT id, username, middlename, photo, number FROM users", [], (err, members) => {
      res.render("groupe", {
        user: req.session.user,
        userProfile: userProfile,
        members: members || [],
        groupName: "Groupe Général",
        memberCount: (members || []).length
      });
    });
  });
});
app.get("/index", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  db.all("SELECT * FROM messages ORDER BY created_at ASC LIMIT 50", [], (err, messages) => {
    if (err) {
      console.error(err.message);
      return res.render("index", { user: req.session.user, messages: [], onlineUsers: [] });
    }

    db.all("SELECT username, photo FROM users", [], (err, users) => {
      if (err) {
        console.error(err.message);
        return res.render("index", { user: req.session.user, messages: messages, onlineUsers: [] });
      }

      res.render("index", { 
        user: req.session.user, 
        messages: messages || [], 
        onlineUsers: users || [] 
      });
    });
  });
});
server.listen(3000, () => {
  console.log("Le serveur est en marche");
});
