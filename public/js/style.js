function animateloading(){
    window.addEventListener('load',()=>{
        const animate=document.querySelector('.loadingpage')
        animate.classList.add('close_animation')
    })
}
animateloading()