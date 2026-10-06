const socket = io();

// Elements
const loginScreen = document.getElementById('login');
const chatScreen = document.getElementById('chat');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const messagesEl = document.getElementById('messages');
const usersEl = document.getElementById('users');
const userCountEl = document.getElementById('userCount');
const roomNameEl = document.getElementById('roomName');
const form = document.getElementById('messageForm');
const input = document.getElementById('messageInput');
const typingEl = document.getElementById('typing');

let myUsername = '';
let typingTimeout;

// Join
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const room = roomInput.value.trim() || 'general';
  if (!username) return alert('Enter a username');

  myUsername = username;
  socket.emit('joinRoom', { username, room });

  roomNameEl.textContent = room;
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  input.focus();
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// Leave
leaveBtn.addEventListener('click', () => location.reload());

// Send message
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  socket.emit('chatMessage', { text });
  socket.emit('typing', false);
  input.value = '';
  input.focus();
});

// Typing indicator
input.addEventListener('input', () => {
  socket.emit('typing', true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('typing', false), 1000);
});

// Receive message
socket.on('message', (msg) => {
  const div = document.createElement('div');

  if (msg.system) {
    div.className = 'msg system';
    div.textContent = msg.text;
  } else {
    div.className = 'msg' + (msg.user === myUsername ? ' own' : '');
    div.innerHTML = `
      <div class="meta"><strong>${escapeHtml(msg.user)}</strong><span>${msg.time}</span></div>
      <div>${escapeHtml(msg.text)}</div>
    `;
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Typing display
socket.on('userTyping', ({ username, isTyping }) => {
  if (isTyping) {
    typingEl.textContent = `${username} is typing...`;
  } else {
    typingEl.textContent = '';
  }
});

// User list
socket.on('userList', (users) => {
  usersEl.innerHTML = users.map((u) => `<li>🟢 ${escapeHtml(u)}</li>`).join('');
  userCountEl.textContent = `${users.length} online`;
});

// Prevent XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}