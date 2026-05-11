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
  CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  contact TEXT,  
  groupe TEXT,  
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table user est créée avec succès");
  },
);

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

db.run(
  `
  CREATE TABLE IF NOT EXISTS groupes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_groupe TEXT,
  membres_groupe INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table groupes est créée avec succès");
  },
);

db.run(
  `
  CREATE TABLE IF NOT EXISTS groupe_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  groupe_id INTEGER,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table groupe_messages est créée avec succès");
  },
);

db.run(
  `
  CREATE TABLE IF NOT EXISTS groupe_members(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  groupe_id INTEGER,
  username TEXT,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table groupe_members est créée avec succès");
  },
);

db.run(
  `
  CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  (err) => {
    if (err) {
      console.log(err.message);
      return;
    }
    console.log("la table notifications est créée avec succès");
  },
);

// Insert fake users
db.run(`INSERT INTO users (username, contact, status) VALUES ('Noa', '0897456248', 'online')`);
db.run(`INSERT INTO users (username, contact, status) VALUES ('Stella', '0856945623', 'offline')`);
db.run(`INSERT INTO users (username, contact, status) VALUES ('Jacques', '0894781624', 'offline')`);
db.run(`INSERT INTO users (username, contact, status) VALUES ('Cedric', '0855963147', 'online')`);
db.run(`INSERT INTO users (username, contact, status) VALUES ('Mersein', '0891526654', 'online')`);

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
        socket.broadcast.emit("chat", data);
      },
    );
    io.emit("chat", data);
  });
});
app.get("/register", (req, res) => {
  res.render("register", {
    photo: "photo",
    nom: "nom",
    prenom: "prenom",
    numero_tel: "numero_tel",
    mdpass: "mdpass",
  });
});
app.post("/login", (req, res) => {
  res.render("login", {
    nom: "nom",
  });
});
app.post("/register", (req, res) => {
  const { username, number } = req.body;

  req.session.user = {
    name: username,
    number: number,
    role: "user",
  };

  res.redirect("/chat");
});
app.get("/", (req, res) => {
  db.all("SELECT * FROM users WHERE status = 'online'", (err, onlineUsers) => {
    if (err) {
      console.error(err);
      onlineUsers = [];
    }
    db.all("SELECT * FROM users", (err, allUsers) => {
      if (err) {
        console.error(err);
        allUsers = [];
      }
      res.render("index", { onlineUsers, users: allUsers });
    });
  });
});
app.get("archive/", (req, res) => {
  res.render("archive", {
    nom: "",
    msg: "message",
  });
});

app.get("/profil", (req, res) => {
  res.render("profil", {
    photo: "photo",
    nom: "nom",
    prenom: "prenom",
    descr: "descr",
  });
});

app.get("/profil", (req, res) => {
  res.render("profil", {
    photo: "photo",
    nom: "nom",
    prenom: "prenom",
    descr: "descr",
  });
});
app.get("/groupe", (req, res) => {
  db.all("SELECT * FROM groupes", (err, groupes) => {
    if (err) {
      console.error(err);
      groupes = [];
    }
    res.render("groupe", {
      groupes: groupes || [],
      nomgroupe: "nomgroupe",
      membresgroupe: "membres_groupe",
    });
  });
});

app.post("/groupe/create", (req, res) => {
  const nom_groupe = (req.body.nom_groupe || "").trim();
  const username = req.session?.user?.name || "Invité";

  if (!nom_groupe) {
    return res.status(400).json({ error: "Le nom du groupe est requis." });
  }

  db.run(
    `INSERT INTO groupes (nom_groupe, membres_groupe) VALUES (?, ?)`,
    [nom_groupe, 1],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Impossible de créer le groupe." });
      }

      const groupeId = this.lastID;
      db.run(
        `INSERT INTO groupe_members (groupe_id, username) VALUES (?, ?)`,
        [groupeId, username],
        (memberErr) => {
          if (memberErr) {
            console.error(memberErr);
            return res.status(500).json({ error: "Impossible d'ajouter le premier membre." });
          }
          res.json({ success: true, groupeId });
        },
      );
    },
  );
});
// Route pour rejoindre un groupe existant sans connexion
app.post("/api/groupe/join/:id", (req, res) => {
  const groupeId = req.params.id;

  db.get("SELECT * FROM groupes WHERE id = ?", [groupeId], (err, groupe) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erreur lors de la récupération du groupe." });
    }
    if (!groupe) {
      return res.status(404).json({ error: "Groupe non trouvé." });
    }

    const nouveauxMembres = (groupe.membres_groupe || 0) + 1;
    db.run(
      "UPDATE groupes SET membres_groupe = ? WHERE id = ?",
      [nouveauxMembres, groupeId],
      (updateErr) => {
        if (updateErr) { 
          console.error(updateErr);
          return res.status(500).json({ error: "Impossible de rejoindre le groupe." });
        }
        return res.json({ success: true, groupeId, membres_groupe: nouveauxMembres });
      },
    );
  });
});
// Route pour chercher les groupes
app.get("/api/search-groups", (req, res) => {
  const searchQuery = req.query.q || "";
  
  const query = `SELECT * FROM groupes WHERE nom_groupe LIKE ? ORDER BY nom_groupe ASC`;
  db.all(query, [`%${searchQuery}%`], (err, groupes) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Erreur lors de la recherche" });
    }
    res.json(groupes || []);
  });
});

server.listen(3000, () => {
  console.log("Le serveur est en marche");
});
 