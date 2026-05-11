const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const server = http.createServer(app);

const sqlite3 = require("sqlite3").verbose();

const session = require("express-session");

const io = new Server(server);
const userConnections = new Map();

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
  recipient TEXT,
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
    groupe TEXT,  
    password TEXT,
    photo TEXT 
  )`, (err) => {
    if (err) console.log("Erreur table users:", err.message);
    else console.log("Table users prête.");
});
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

io.on("connection", (socket) => {
  console.log("Un utilisateur s'est connecté");

  const broadcastOnlineUsers = () => {
    io.emit('online-users', Array.from(userConnections.keys()));
  };

  socket.on('join', (username) => {
    socket.username = username;
    socket.join(username);

    const count = userConnections.get(username) || 0;
    userConnections.set(username, count + 1);
    console.log(`${username} a rejoint sa room personnelle (${count + 1})`);

    broadcastOnlineUsers();
  });

  socket.on('disconnect', () => {
    if (!socket.username) return;
    const count = userConnections.get(socket.username) || 0;
    if (count <= 1) {
      userConnections.delete(socket.username);
    } else {
      userConnections.set(socket.username, count - 1);
    }
    broadcastOnlineUsers();
  });

  socket.on("chat", (data) => {
    if (!data.recipient) {
      socket.emit('error', 'Destinataire manquant');
      return;
    }

    db.run(
      `INSERT INTO messages(username, recipient, content) VALUES(?,?,?)`,
      [data.name, data.recipient, data.message],
      (err) => {
        if (err) {
          console.log(err);
          socket.emit('error', 'Erreur lors de la sauvegarde du message');
          return;
        }
        const messageData = {
          username: data.name,
          recipient: data.recipient,
          content: data.message,
          created_at: new Date().toISOString()
        };
        socket.to(data.recipient).emit("chat", messageData);
        socket.emit("chat", messageData);
      },
    );
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

// app.get("/groupe", (req, res) => {
//   if (!req.session.user) return res.redirect("/");
  
//   db.get("SELECT * FROM users WHERE id = ?", [req.session.user.id], (err, userProfile) => {
//     if (err || !userProfile) {
//       userProfile = req.session.user;
//     }

//     // Récupérer tous les utilisateurs pour les afficher comme membres
//     db.all("SELECT id, username, middlename, photo, number FROM users", [], (err, members) => {
//       res.render("groupe", {
//         user: req.session.user,
//         userProfile: userProfile,
//         members: members || [],
//         groupName: "Groupe Général",
//         memberCount: (members || []).length
//       });
//     });
//   });
// });

app.get("/groupe", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const user = req.session.user;

  db.all("SELECT * FROM groupes", (err, groupes) => {
    if (err) {
      console.error(err);
      groupes = [];
    }

    db.all(
      "SELECT groupe_id FROM groupe_members WHERE username = ?",
      [user.username],
      (memberErr, memberships) => {
        if (memberErr) {
          console.error(memberErr);
          memberships = [];
        }

        const memberGroups = (memberships || []).map((row) => row.groupe_id);
        res.render("groupe", {
          groupes: groupes || [],
          nomgroupe: "nomgroupe",
          membresgroupe: "membres_groupe",
          user,
          memberGroups,
        });
      },
    );
  });
});

app.post("/groupe/create", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Vous devez être connecté pour créer un groupe." });
  }

  const nom_groupe = (req.body.nom_groupe || "").trim();
  const username = req.session.user.username;

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

app.get("/index", (req, res) => {
  if (!req.session.user) return res.redirect("/");

    const username = req.session.user.username;
    db.all("SELECT * FROM messages WHERE username = ? OR recipient = ? ORDER BY created_at ASC LIMIT 50", [username, username], (err, messages) => {
  
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

// Route pour récupérer les groupes d'un utilisateur
app.get("/api/user/member-groups", (req, res) => {
  if (!req.session.user) {
    return res.json([]);
  }

  db.all(
    "SELECT groupe_id FROM groupe_members WHERE username = ?",
    [req.session.user.username],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erreur lors de la récupération des groupes" });
      }
      res.json((rows || []).map((row) => row.groupe_id));
    },
  );
});

// Route pour récupérer l'historique d'un chat privé
app.get("/api/messages/:contact", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Non connecté" });
  }

  const username = req.session.user.username;
  const contact = req.params.contact;

  db.all(
    `SELECT * FROM messages WHERE (username = ? AND recipient = ?) OR (username = ? AND recipient = ?) ORDER BY created_at ASC`,
    [username, contact, contact, username],
    (err, messages) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erreur lors de la récupération des messages" });
      }
      res.json(messages || []);
    },
  );
});

// Route pour rejoindre un groupe
app.post("/api/groupe/join/:id", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Vous devez être connecté pour rejoindre le groupe." });
  }

  const groupeId = req.params.id;
  const username = req.session.user.username;

  db.get(
    "SELECT * FROM groupe_members WHERE groupe_id = ? AND username = ?",
    [groupeId, username],
    (err, existingMember) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erreur lors de la vérification du membre." });
      }
      if (existingMember) {
        return res.json({ success: true, alreadyMember: true });
      }

      db.get("SELECT * FROM groupes WHERE id = ?", [groupeId], (groupErr, groupe) => {
        if (groupErr) {
          console.error(groupErr);
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

            db.run(
              "INSERT INTO groupe_members (groupe_id, username) VALUES (?, ?)",
              [groupeId, username],
              (memberErr) => {
                if (memberErr) {
                  console.error(memberErr);
                  return res.status(500).json({ error: "Impossible d'ajouter le membre." });
                }
                return res.json({ success: true, groupeId, membres_groupe: nouveauxMembres });
              },
            );
          },
        );
      });
    },
  );
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

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la déconnexion', err);
      return res.redirect('/index');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

server.listen(3000, () => {
  console.log("Le serveur est en marche");
});
