const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express(), server=http.createServer(app), io=new Server(server);
const PORT=process.env.PORT||3000;
app.use(express.static(path.join(__dirname,"public")));

const rooms=new Map();
function getRoom(id){
  if(!rooms.has(id)) rooms.set(id,{movie:null,playing:false,position:0,updatedAt:Date.now(),users:new Map()});
  return rooms.get(id);
}
function users(r){return [...r.users.values()].map(x=>({id:x.id,name:x.name}));}

io.on("connection",socket=>{
  socket.on("join-room",({roomId,name,movie})=>{
    roomId=String(roomId||"").trim().toUpperCase().slice(0,32);
    name=String(name||"სტუმარი").trim().slice(0,24)||"სტუმარი";
    if(!roomId)return;
    const r=getRoom(roomId);
    socket.join(roomId); socket.data.roomId=roomId; socket.data.name=name;
    r.users.set(socket.id,{id:socket.id,name});
    if(movie && !r.movie) r.movie=movie;
    socket.emit("room-state",{movie:r.movie,playing:r.playing,
      position:r.position+(r.playing?(Date.now()-r.updatedAt)/1000:0),users:users(r)});
    socket.to(roomId).emit("users-updated",users(r));
    io.to(roomId).emit("system-message",`${name} შემოვიდა ოთახში 👋`);
  });

  socket.on("set-movie",movie=>{
    const id=socket.data.roomId;if(!id)return;const r=getRoom(id);
    r.movie=movie;r.position=0;r.playing=false;r.updatedAt=Date.now();
    io.to(id).emit("movie-changed",movie);
  });

  socket.on("sync-action",({action,position})=>{
    const id=socket.data.roomId;if(!id)return;const r=getRoom(id);
    r.position=Number(position)||0;r.playing=action==="play";r.updatedAt=Date.now();
    socket.to(id).emit("sync-action",{action,position:r.position});
  });

  socket.on("chat-message",text=>{
    const id=socket.data.roomId;if(!id)return;
    text=String(text||"").trim().slice(0,500);if(!text)return;
    io.to(id).emit("chat-message",{name:socket.data.name,text,time:new Date().toLocaleTimeString("ka-GE",{hour:"2-digit",minute:"2-digit"})});
  });

  socket.on("disconnect",()=>{
    const id=socket.data.roomId;if(!id||!rooms.has(id))return;
    const r=rooms.get(id),u=r.users.get(socket.id);r.users.delete(socket.id);
    if(u)io.to(id).emit("system-message",`${u.name} გავიდა ოთახიდან.`);
    io.to(id).emit("users-updated",users(r));
    if(!r.users.size)setTimeout(()=>{if(rooms.get(id)?.users.size===0)rooms.delete(id)},60000);
  });
});
server.listen(PORT,()=>console.log(`MovieRoom v2: http://localhost:${PORT}`));