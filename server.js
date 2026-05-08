const express=require('express')
const app=express()
const http=require('http')
const path=require('path')
const { Server } = require('socket.io')
const server=http.createServer(app)
const io= new Server(server)

app.set('view engine','ejs')
app.use(express.static('public'))
app.use(express.urlencoded({extended:true}))

io.on('connection',(socket)=>{
    console.log("Un utilisateur s'est conncecté ")
    socket.on('chat',(data)=>{
        io.emit('chat',data)
    })
})
app.get('/register',(req,res)=>{
    res.render('register',{
        photo:'photo',
        nom:'nom',
        prenom:'prenom',
        numero_tel:'numero_tel',
        mdpass:'mdpass'
    })
})
app.get('/login',(req,res)=>{
    res.render('login',{
        nom:'nom'
    })
})
app.get('/',(req,res)=>{
    res.render('index',{
        message:'message',
        data:'date'
    })
})
app.get('archive/',(req,res)=>{
    res.render('archive',{
        nom:'',
        msg:'message'
    })
})
app.get('/profil',(req,res)=>{
    res.render('profil',{
        nom:'nom',
        prenom:'prenom',
        numerotel:'numerotel'
    })
})
app.get('/archive',(req,res)=>{
    res.render('archive',{
        nom:'nom',
        prenom:'prenom',
    })
})
app.get('/groupe',(req,res)=>{
    res.render('groupe',{
        nomgroupe:'nomgroupe',
        membresgroupe :'membres_groupe'
    })
})
server.listen(3000,()=>{
    console.log('Le serveur est en marche')
})