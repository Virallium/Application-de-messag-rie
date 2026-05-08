const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const server = http.createServer(app);

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

io.on("connection", (socket) => {
  console.log("Un utilisateur s'est conncecté ");
  socket.on("chat", (data) => {
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
// app.get("/login", (req, res) => {
//   res.render("login", {
//     nom: "nom",
//   });
// });
app.get("/", (req, res) => {
  res.render("login", {
    // message: "message",
    // data: "date",
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

server.listen(3000, () => {
  console.log("Le serveur est en marche");
});
