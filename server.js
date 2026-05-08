const express = require('express')
const app = express()
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const server = http.createServer(app)
const io = new Server(server)

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

io.on('connection', (socket) => {
    console.log("Un utilisateur s'est conncecté ")
    socket.on('chat', (data) => {
        io.emit('chat', data)
    })
})
app.get('/register', (req, res) => {
    res.render('register', {
        photo: 'photo',
        nom: 'nom',
        prenom: 'prenom',
        numero_tel: 'numero_tel',
        mdpass: 'mdpass'
    })
})
app.get('/login', (req, res) => {
    res.render('login', {
        nom: 'nom'
    })
})
app.get('/', (req, res) => {
    res.render('index', {
        message: 'message',
        data: 'date'
    })
})
app.get('archive/', (req, res) => {
    res.render('archive', {
        nom: '',
        msg: 'message'
    })
})


app.get('/profil', (req, res) => {
    res.render('profil', {
        photo: 'photo',
        nom: 'nom',
        prenom: 'prenom',
        descr: 'descr'
    })
})

app.get('/profile', (req, res) => {
    // Exemple de données user (à adapter selon votre logique d'authentification)
    const user = {
        nom: 'John',
        prenom: 'Doe',
        telephone: '+221771234567',
        email: 'john@example.com',
        genre: 'homme',
        bio: 'Bonjour, je suis sur cette application de messagerie'
    };

    res.render('profil', { user });
});

server.listen(3000, () => {
    app.get('/groupe', (req, res) => {
        res.render('groupe', {
            nomgroupe: 'nomgroupe',
            membresgroupe: 'membres_groupe'
        })
    })

})