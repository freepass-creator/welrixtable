<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { docStore, chatStore } from '../store.js';
import { sendChatMessage, watchChatMessages, isManager } from '../firebase/chat.js';
import { waitAuth, auth } from '../firebase/config.js';

const fmtSize = (b) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

const totalDocs = computed(() => (docStore.license ? 1 : 0) + docStore.attachments.length);

const accOpen = ref(true);
const memo = ref('');
const licDragOver = ref(false);
const attDragOver = ref(false);
const licInputEl = ref(null);
const attInputEl = ref(null);

// === 채팅: 영업자별 단일 채널 (견적 발송과 무관, 항상 활성) ===
const myUid = ref(null);
const iAmManager = ref(false);
const editingNick = ref(false);
const chatReady = ref(false);
let unsubscribeMsg = null;

onMounted(async () => {
  await waitAuth();
  myUid.value = auth.currentUser?.uid || null;
  iAmManager.value = await isManager();
  if (myUid.value) bindChat(myUid.value);
});
onUnmounted(() => {
  if (unsubscribeMsg) unsubscribeMsg();
});

function bindChat(channelUid) {
  if (unsubscribeMsg) { unsubscribeMsg(); unsubscribeMsg = null; }
  chatStore.messages.splice(0, chatStore.messages.length);
  if (!channelUid) return;
  unsubscribeMsg = watchChatMessages(channelUid, (msg) => {
    if (chatStore.messages.find(m => m.id === msg.id)) return;
    chatStore.messages.push(msg);
    nextTick(() => {
      if (chatBoxEl.value) chatBoxEl.value.scrollTop = chatBoxEl.value.scrollHeight;
    });
  });
  chatReady.value = true;
}

function onLicChange(e) {
  docStore.license = e.target.files[0] || null;
}
function removeLicense() {
  docStore.license = null;
  if (licInputEl.value) licInputEl.value.value = '';
}
function onLicDrop(e) {
  e.preventDefault();
  licDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (files.length) docStore.license = files[0];
}

function onAttChange(e) {
  docStore.attachments.push(...Array.from(e.target.files || []));
  if (attInputEl.value) attInputEl.value.value = '';
}
function removeAtt(i) {
  docStore.attachments.splice(i, 1);
}
function onAttDrop(e) {
  e.preventDefault();
  attDragOver.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) docStore.attachments.push(...files);
}

function submit() {
  if (!docStore.license) { alert('운전면허증을 첨부해 주세요.'); return; }
  alert(`계약 접수 요청 전송\n- 면허증: ${docStore.license.name}\n- 첨부서류 ${docStore.attachments.length}건\n- 메모: ${memo.value || '(없음)'}\n(다음 단계: Firebase 연동)`);
}

// === 채팅 입력 ===
const chatInput = ref('');
const chatBoxEl = ref(null);
const sending = ref(false);

async function sendMsg() {
  const text = chatInput.value.trim();
  if (!text) return;
  if (!chatReady.value) {
    alert('채팅 연결 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  sending.value = true;
  try {
    await sendChatMessage(text, chatStore.nickname);
    chatInput.value = '';
  } catch (e) {
    console.error('[chat]', e);
    alert('전송 실패: ' + (e.message || e));
  } finally {
    sending.value = false;
  }
}
function onChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}
function startEditNick() { editingNick.value = true; }
function commitNick(e) {
  const v = (e.target.value || '').trim();
  if (v) chatStore.nickname = v;  // store watch 가 localStorage 저장
  editingNick.value = false;
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <!-- 계약 접수 -->
  <details class="contract-top" :open="accOpen" @toggle="accOpen = $event.target.open">
    <summary class="contract-acc-summary">
      <span class="contract-pane-title" style="margin:0;">
        <i class="ph ph-clipboard-text"></i>계약 접수
      </span>
      <span class="contract-acc-count" :class="{ has: totalDocs > 0 }">
        {{ totalDocs ? totalDocs + '건' : '' }}
      </span>
      <span class="contract-acc-caret"></span>
    </summary>
    <div class="contract-acc-body">
      <!-- 면허증 -->
      <label class="doc-dropzone single"
        :class="{ dragover: licDragOver, 'has-file': !!docStore.license }"
        @dragenter.prevent="licDragOver = true"
        @dragover.prevent="licDragOver = true"
        @dragleave.prevent="licDragOver = false"
        @drop="onLicDrop">
        <span class="doc-dz-icon"><i class="ph ph-identification-card"></i></span>
        <span class="doc-dz-text">
          <b>운전면허증 <em>필수</em></b>
          <small>이미지/PDF · 끌어 놓거나 클릭</small>
        </span>
        <input ref="licInputEl" type="file" hidden accept="image/*,.pdf" @change="onLicChange" />
      </label>
      <div v-if="docStore.license" class="doc-file-list">
        <div class="doc-file-item">
          <i class="ph ph-file-text"></i>
          <span class="name">{{ docStore.license.name }}</span>
          <span class="size">{{ fmtSize(docStore.license.size) }}</span>
          <span class="remove" @click="removeLicense">✕</span>
        </div>
      </div>

      <!-- 첨부서류 -->
      <label class="doc-dropzone"
        style="margin-top:8px;"
        :class="{ dragover: attDragOver, 'has-file': docStore.attachments.length > 0 }"
        @dragenter.prevent="attDragOver = true"
        @dragover.prevent="attDragOver = true"
        @dragleave.prevent="attDragOver = false"
        @drop="onAttDrop">
        <span class="doc-dz-icon"><i class="ph ph-paperclip"></i></span>
        <span class="doc-dz-text">
          <b>첨부서류</b>
          <small>신분증·소득증빙 등 · 끌어 놓거나 클릭 (여러 파일)</small>
        </span>
        <input ref="attInputEl" type="file" hidden multiple accept="image/*,.pdf" @change="onAttChange" />
      </label>
      <div v-if="docStore.attachments.length" class="doc-file-list">
        <div v-for="(f, i) in docStore.attachments" :key="i" class="doc-file-item">
          <i class="ph ph-file-text"></i>
          <span class="name">{{ f.name }}</span>
          <span class="size">{{ fmtSize(f.size) }}</span>
          <span class="remove" @click="removeAtt(i)">✕</span>
        </div>
      </div>

      <textarea class="contract-memo" rows="2" placeholder="추가 요청사항이나 메모" style="margin-top:10px;" v-model="memo"></textarea>
      <button class="contract-submit" @click="submit">
        계약 접수 요청 <i class="ph ph-arrow-right"></i>
      </button>
    </div>
  </details>

  <!-- 채팅 — 영업담당 ↔ 견적관리자 (항상 활성) -->
  <div class="contract-bottom">
    <div class="contract-pane-title">
      <i class="ph ph-chat-circle"></i>관리자 채팅
      <span class="badge" v-show="chatStore.messages.length">{{ chatStore.messages.length }}</span>
      <span class="chat-state-hint" v-if="!chatReady">연결 중...</span>
    </div>
    <div ref="chatBoxEl" class="chat-messages">
      <div v-if="chatStore.messages.length === 0" class="chat-system">
        <i class="ph ph-chat-circle"></i>
        <span>견적관리자와 자유롭게 대화하세요.<br>견적 발송 시 자동으로 발송 기록이 채팅에 남습니다.</span>
      </div>
      <div v-for="m in chatStore.messages" :key="m.id"
           class="chat-msg" :class="{
             me: m.uid === myUid && m.sender !== 'system',
             them: m.uid !== myUid && m.sender !== 'system',
             manager: m.sender === 'manager',
             system: m.sender === 'system',
           }">
        <div class="chat-msg__author" v-if="m.sender !== 'system'">
          <span class="role-tag" v-if="m.sender === 'manager'">관리자</span>
          {{ m.name || (m.sender === 'manager' ? '견적관리자' : '영업담당') }}
          <span class="chat-msg__time">{{ fmtTime(m.at) }}</span>
        </div>
        <div class="chat-msg__text">{{ m.text }}</div>
        <div class="chat-msg__time chat-msg__time--system" v-if="m.sender === 'system'">{{ fmtTime(m.at) }}</div>
      </div>
    </div>
    <div class="chat-input-row">
      <textarea class="chat-input" rows="1"
                placeholder="메시지 (Enter 전송, Shift+Enter 줄바꿈)"
                :disabled="!chatReady || sending"
                v-model="chatInput" @keydown="onChatKey"></textarea>
      <button class="chat-send" title="전송" aria-label="전송"
              :disabled="!chatReady || sending || !chatInput.trim()"
              @click="sendMsg">
        <i class="ph ph-paper-plane-tilt"></i>
      </button>
    </div>
    <div class="chat-user-bar">
      <template v-if="!editingNick">
        <span class="chat-user-name" @click="startEditNick" title="클릭하면 변경">
          <i class="ph ph-user"></i>{{ chatStore.nickname }}
          <i class="ph ph-pencil-simple chat-edit-icon"></i>
        </span>
      </template>
      <template v-else>
        <input type="text" class="chat-nick-input"
               :value="chatStore.nickname"
               @blur="commitNick"
               @keydown.enter="commitNick($event)"
               placeholder="예: 신촌점 홍길동"
               maxlength="60" autofocus />
      </template>
      <span class="chat-help">대화명 = 관리자에게 표시되는 이름</span>
    </div>
  </div>
</template>
