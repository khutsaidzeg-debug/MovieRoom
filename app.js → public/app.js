const movies=[
{id:"demo1",title:"Midnight City",year:2026,genre:"დრამა",rating:"8.1",poster:"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80",desc:"ღამის ქალაქში ორი მეგობრის ისტორია, რომელიც მოულოდნელად იცვლება.",video:""},
{id:"demo2",title:"The Last Journey",year:2025,genre:"თავგადასავალი",rating:"8.4",poster:"https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=700&q=80",desc:"ორი მეგობარი იწყებს მოგზაურობას, რომელიც მათ ცხოვრებას შეცვლის.",video:""},
{id:"demo3",title:"After Rain",year:2024,genre:"რომანტიკა",rating:"7.8",poster:"https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=700&q=80",desc:"მშვიდი ქალაქი, ძველი მოგონებები და ახალი შეხვედრა.",video:""},
{id:"demo4",title:"Dark Signal",year:2026,genre:"თრილერი",rating:"8.7",poster:"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80",desc:"უცნაური სიგნალი ოთხ მეგობარს ღამის ქალაქში შეკრებს.",video:""}
];
const $=x=>document.getElementById(x);let socket=null,current=null,room="";
function render(){
 const hash=location.hash||"#/";
 if(hash.startsWith("#/room/")) return roomPage(hash.split("/")[2]);
 if(hash.startsWith("#/movie/")) return detail(hash.split("/")[2]);
 home();
}
function home(){
 $("app").innerHTML=`<div class="wrap"><section class="hero"><span class="badge">WATCH PARTY</span><h1>ფილმები.<br><span>მეგობრები. ერთად.</span></h1><p>აირჩიე ფილმი, შექმენი ოთახი და გაუზიარე ლინკი მეგობრებს. უყურეთ სინქრონულად და ისაუბრეთ ჩატში.</p></section><input id="search" class="search" placeholder="🔎  მოძებნე ფილმი..."><div id="grid" class="grid"></div></div>`;
 const draw=q=>{$("grid").innerHTML=movies.filter(m=>(m.title+" "+m.genre).toLowerCase().includes(q.toLowerCase())).map(m=>`<article class="movie" onclick="location.hash='#/movie/${m.id}'"><img class="poster" src="${m.poster}"><div class="movie-info"><h3>${m.title}</h3><span class="muted">${m.year} · ${m.genre} · ⭐ ${m.rating}</span></div></article>`).join("")};
 draw("");$("search").oninput=e=>draw(e.target.value);
}
function detail(id){
 current=movies.find(m=>m.id===id);if(!current)return home();
 $("app").innerHTML=`<div class="wrap"><div class="detail"><img class="poster" src="${current.poster}"><div><span class="badge">${current.genre}</span><h1>${current.title}</h1><span class="pill">${current.year}</span><span class="pill">⭐ ${current.rating}</span><p class="hero p">${current.desc}</p><div class="actions"><button class="primary" onclick="openModal('${current.id}')">▶ ოთახის შექმნა</button><button class="secondary" onclick="location.hash='#/'">← უკან</button></div><p class="muted" style="margin-top:25px">ვიდეოს ფაილის URL შეიძლება დაემატოს ოთახში. გამოიყენე მხოლოდ შენთვის ნებადართული ვიდეოკონტენტი.</p></div></div></div>`;
}
function openModal(id){current=movies.find(m=>m.id===id);$("modalMovie").textContent=current.title;$("modal").hidden=false;$("name").focus()}
function closeModal(){$("modal").hidden=true}
$("makeRoom").onclick=()=>{const n=$("name").value.trim()||"სტუმარი";room=Math.random().toString(36).slice(2,8).toUpperCase();sessionStorage.name=n;location.hash=`#/room/${room}`};
function roomPage(id){
 room=id.toUpperCase();const movie=current||movies[0];
 $("app").innerHTML=`<div class="room"><div class="roomgrid"><section><div class="video"><video id="vid" controls playsinline></video></div><div style="padding:12px 0;display:flex;gap:8px"><input id="url" style="flex:1;background:#11131a;border:1px solid #252936;border-radius:10px;padding:12px;color:#fff" placeholder="MP4/WebM ვიდეოს პირდაპირი URL"><button class="primary" onclick="setVideo()">დამატება</button></div></section><aside class="roomside"><div class="sidehead"><b>ROOM · ${room}</b></div><div class="invite">მოიწვიე მეგობარი <button onclick="navigator.clipboard.writeText(location.href);alert('ლინკი დაკოპირდა')">ლინკის კოპირება</button></div><div class="people"><b>მონაწილეები <span id="count">0</span></b><div id="users"></div></div><div class="chat"><b>ჩატი</b><div id="messages" class="messages"></div><form id="chatform" class="chatform"><input id="chat" placeholder="დაწერე..."><button>➤</button></form></div></aside></div></div>`;
 socket=io();socket.emit("join-room",{roomId:room,name:sessionStorage.name||"სტუმარი",movie:movie});
 const v=$("vid");v.onplay=()=>socket.emit("sync-action",{action:"play",position:v.currentTime});v.onpause=()=>socket.emit("sync-action",{action:"pause",position:v.currentTime});v.onseeked=()=>socket.emit("sync-action",{action:v.paused?"pause":"play",position:v.currentTime});
 socket.on("room-state",s=>{if(s.movie?.video){v.src=s.movie.video;v.currentTime=s.position||0}updateUsers(s.users);});
 socket.on("movie-changed",m=>{if(m?.video){v.src=m.video;v.play().catch(()=>{})}});
 socket.on("sync-action",s=>{v.currentTime=s.position||0;s.action==="play"?v.play().catch(()=>{}):v.pause()});
 socket.on("users-updated",updateUsers);socket.on("chat-message",addMsg);socket.on("system-message",t=>addMsg({name:"სისტემა",text:t,time:""}));
 $("chatform").onsubmit=e=>{e.preventDefault();const x=$("chat");if(x.value.trim()){socket.emit("chat-message",x.value);x.value=""}};
}
function setVideo(){const url=$("url").value.trim();if(url)socket.emit("set-movie",{title:"ვიდეო",video:url})}
function updateUsers(us){$("count").textContent=us.length;$("users").innerHTML=us.map(u=>`<div class="person">● ${esc(u.name)}</div>`).join("")}
function addMsg(m){const d=document.createElement("div");d.className="msg";d.innerHTML=`<b>${esc(m.name)}</b> <span class="muted">${esc(m.time||"")}</span><p>${esc(m.text)}</p>`;$("messages").append(d);$("messages").scrollTop=$("messages").scrollHeight}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
window.addEventListener("hashchange",render);render();
