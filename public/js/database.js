const sqlite3=require('sqlite3')
const path=require('path')
const db= new sqlite3.Database('/ma_bd.db',(err)=>{
    console.log('Connecté à la base de données SQLite.');
})