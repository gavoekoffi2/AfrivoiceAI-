/**
 * AfrivoiceAI — widget embarquable.
 *
 * Snippet d'intégration (voir INTEGRATION.md) :
 *   <script src="https://VOTRE-INSTANCE/widget.js" defer
 *           data-public-key="pk_..." data-agent-id="UUID"></script>
 *
 * Sécurité : seule la clé PUBLIQUE de l'organisation transite côté client.
 * Le serveur vérifie l'Origin de la page contre l'allowlist de domaines de
 * l'organisation avant d'ouvrir une session.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var HOST = script.getAttribute("data-host") || new URL(script.src).origin;
  var PUBLIC_KEY = script.getAttribute("data-public-key");
  var AGENT_ID = script.getAttribute("data-agent-id");
  var ACCENT = script.getAttribute("data-color") || "#0f766e";

  if (!PUBLIC_KEY || !AGENT_ID) {
    console.error("[AfrivoiceAI] data-public-key et data-agent-id sont requis.");
    return;
  }

  var state = {
    token: null,
    agent: null,
    conversationId: null,
    open: false,
    recording: false,
    mediaRecorder: null,
    chunks: [],
  };

  // --- UI --------------------------------------------------------------------

  var root = document.createElement("div");
  root.id = "afrivoice-widget";
  root.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:system-ui,sans-serif;";

  var bubble = document.createElement("button");
  bubble.setAttribute("aria-label", "Ouvrir l'assistant vocal");
  bubble.style.cssText =
    "width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:" +
    ACCENT +
    ";color:#fff;font-size:24px;box-shadow:0 4px 14px rgba(0,0,0,.25);";
  bubble.textContent = "🎙";

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;flex-direction:column;width:320px;height:420px;background:#fff;border-radius:12px;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.25);overflow:hidden;margin-bottom:10px;";

  var header = document.createElement("div");
  header.style.cssText =
    "padding:12px 14px;background:" + ACCENT + ";color:#fff;font-weight:600;font-size:14px;";
  header.textContent = "Assistant";

  var messages = document.createElement("div");
  messages.style.cssText =
    "flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8fafc;";

  var form = document.createElement("form");
  form.style.cssText = "display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;";

  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Écrire un message…";
  input.style.cssText =
    "flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;";

  var micBtn = document.createElement("button");
  micBtn.type = "button";
  micBtn.title = "Parler";
  micBtn.style.cssText =
    "border:none;border-radius:8px;padding:8px 10px;cursor:pointer;background:#e2e8f0;font-size:15px;";
  micBtn.textContent = "🎤";

  var sendBtn = document.createElement("button");
  sendBtn.type = "submit";
  sendBtn.style.cssText =
    "border:none;border-radius:8px;padding:8px 12px;cursor:pointer;background:" +
    ACCENT +
    ";color:#fff;font-size:13px;";
  sendBtn.textContent = "Envoyer";

  form.appendChild(input);
  form.appendChild(micBtn);
  form.appendChild(sendBtn);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(form);
  root.appendChild(panel);
  root.appendChild(bubble);
  document.body.appendChild(root);

  function addMessage(role, text) {
    var el = document.createElement("div");
    el.style.cssText =
      "max-width:85%;padding:8px 10px;border-radius:10px;font-size:13px;line-height:1.4;white-space:pre-wrap;" +
      (role === "user"
        ? "align-self:flex-end;background:" + ACCENT + ";color:#fff;"
        : "align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#0f172a;");
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function playAudioBase64(b64) {
    try {
      var audio = new Audio("data:audio/wav;base64," + b64);
      audio.play().catch(function () {});
    } catch (e) {
      /* lecture refusée : le texte reste affiché */
    }
  }

  // --- Session -----------------------------------------------------------------

  function openSession() {
    return fetch(HOST + "/api/widget/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: PUBLIC_KEY, agentId: AGENT_ID }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body.message || body.error || "session refusée");
          return body;
        });
      })
      .then(function (body) {
        state.token = body.token;
        state.agent = body.agent;
        header.textContent = body.agent.name;
        if (messages.childElementCount === 0) {
          addMessage("agent", body.agent.greeting);
        }
      });
  }

  function ensureSession() {
    if (state.token) return Promise.resolve();
    return openSession();
  }

  // --- Texte ---------------------------------------------------------------------

  function sendText(text) {
    addMessage("user", text);
    var pending = addMessage("agent", "…");
    return ensureSession()
      .then(function () {
        return fetch(HOST + "/api/widget/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.token,
            message: text,
            conversationId: state.conversationId || undefined,
          }),
        });
      })
      .then(function (r) {
        return r.json().then(function (body) {
          if (r.status === 401) {
            state.token = null; // session expirée → retenter une fois
            return openSession().then(function () {
              return fetch(HOST + "/api/widget/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: state.token,
                  message: text,
                  conversationId: state.conversationId || undefined,
                }),
              }).then(function (r2) {
                return r2.json();
              });
            });
          }
          if (!r.ok) throw new Error(body.message || body.error || "erreur");
          return body;
        });
      })
      .then(function (body) {
        state.conversationId = body.conversationId || state.conversationId;
        pending.textContent = body.reply;
      })
      .catch(function (err) {
        pending.textContent = "⚠ " + err.message;
      });
  }

  // --- Voix ------------------------------------------------------------------------

  function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      addMessage("agent", "⚠ La voix n'est pas supportée par ce navigateur — utilisez le texte.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        state.chunks = [];
        state.mediaRecorder = new MediaRecorder(stream);
        state.mediaRecorder.ondataavailable = function (e) {
          if (e.data.size > 0) state.chunks.push(e.data);
        };
        state.mediaRecorder.onstop = function () {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          sendVoice(new Blob(state.chunks, { type: "audio/webm" }));
        };
        state.mediaRecorder.start();
        state.recording = true;
        micBtn.textContent = "⏹";
        micBtn.style.background = "#fecaca";
      })
      .catch(function () {
        addMessage("agent", "⚠ Micro refusé — utilisez le texte.");
      });
  }

  function stopRecording() {
    if (state.mediaRecorder && state.recording) {
      state.mediaRecorder.stop();
      state.recording = false;
      micBtn.textContent = "🎤";
      micBtn.style.background = "#e2e8f0";
    }
  }

  function sendVoice(blob) {
    var pending = addMessage("agent", "…");
    ensureSession()
      .then(function () {
        var fd = new FormData();
        fd.append("token", state.token);
        fd.append("audio", blob, "utterance.webm");
        if (state.conversationId) fd.append("conversationId", state.conversationId);
        return fetch(HOST + "/api/widget/voice", { method: "POST", body: fd });
      })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body.message || body.error || "erreur");
          return body;
        });
      })
      .then(function (body) {
        state.conversationId = body.conversationId || state.conversationId;
        pending.remove();
        addMessage("user", body.userText);
        addMessage("agent", body.reply);
        if (body.audio) playAudioBase64(body.audio);
      })
      .catch(function (err) {
        pending.textContent = "⚠ " + err.message;
      });
  }

  // --- Événements --------------------------------------------------------------------

  bubble.addEventListener("click", function () {
    state.open = !state.open;
    panel.style.display = state.open ? "flex" : "none";
    if (state.open) {
      ensureSession().catch(function (err) {
        addMessage("agent", "⚠ " + err.message);
      });
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendText(text);
  });

  micBtn.addEventListener("click", function () {
    if (state.recording) stopRecording();
    else startRecording();
  });
})();
