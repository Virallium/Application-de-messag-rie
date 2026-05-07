const express=require('express')
const app=express()
const http=require('http')
const path=require('path')
const { Server } = require('socket.io')
const io= new Server(server)
const server=http.createServer(app)

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
app.listen(5000,()=>{
    console.log('Le serveur est en marche')
})