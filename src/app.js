const { ref, reactive, computed, onBeforeUnmount } = Vue;

const app = {
    setup() {
        // -----------------------------------------------------------------------------
        // Состояние
        // -----------------------------------------------------------------------------
        const ws = ref(null);
        const wsUrl = ref('ws://localhost:8080');
        const pingTimer = ref(null);

        const form = reactive({
            id: 0,
            x: 0,
            y: 0,
            z: 0,
            rot_x: 0,
            rot_y: 0,
            rot_z: 0,
        });
        const placements = reactive(new Map());

        // -----------------------------------------------------------------------------
        // Вычисляемые свойства
        // -----------------------------------------------------------------------------
        const connected = computed(() => ws.value && ws.value.readyState === WebSocket.OPEN);
        const placementsArray = computed(() => Array.from(placements.values()));

        // -----------------------------------------------------------------------------
        // WebSocket события
        // -----------------------------------------------------------------------------
        function handleOpen() {
            sendCommand(form.id, CommandID.CONNECT);
            startPingTimer();
        }

        function handleClose() {
            stopPingTimer();
            ws.value = null;
        }

        function handleMessage(event) {
            const buffer = event.data;
            if (buffer.byteLength === 0) return;

            const type = new DataView(buffer).getUint8(0);

            switch (type) {
                case MessageType.COMMAND: {
                    const cmd = deserializeCommand(buffer);
                    if (!cmd) return;

                    if (cmd.cmd === CommandID.DISCONNECT) placements.delete(cmd.id);

                    break;
                }

                case MessageType.PLACEMENT: {
                    const arr = deserializePlacements(buffer);
                    for (const p of arr) placements.set(p.id, p);

                    break;
                }

                default:
                    return;
            }
        }

        // -----------------------------------------------------------------------------
        // Таймер пинга
        // -----------------------------------------------------------------------------
        function startPingTimer() {
            stopPingTimer(); // останавливаем старый таймер, если есть

            pingTimer.value = setInterval(() => {
                if (connected.value) sendCommand(form.id, CommandID.PING);
            }, 3000);
        }

        function stopPingTimer() {
            if (!pingTimer.value) return;

            clearInterval(pingTimer.value);
            pingTimer.value = null;
        }

        // -----------------------------------------------------------------------------
        // Отправка данных
        // -----------------------------------------------------------------------------
        function sendCommand(id, cmd) {
            if (!connected.value) return;

            ws.value.send(serializeCommand(id, cmd));
        }

        function sendPlacement() {
            if (!connected.value) return;

            ws.value.send(serializePlacement(form));
            // Перезапуск таймера при отправке Placement
            startPingTimer();
        }

        // -----------------------------------------------------------------------------
        // Подключение / отключение
        // -----------------------------------------------------------------------------
        function toggleConnection() {
            if (connected.value) {
                sendCommand(form.id, CommandID.DISCONNECT);
                stopPingTimer();
                ws.value.close();
                return;
            }

            ws.value = new WebSocket(wsUrl.value);
            ws.value.binaryType = 'arraybuffer';

            ws.value.onopen = handleOpen;
            ws.value.onclose = handleClose;
            ws.value.onmessage = handleMessage;
        }

        // -----------------------------------------------------------------------------
        // Очистка при размонтировании
        // -----------------------------------------------------------------------------
        onBeforeUnmount(() => {
            stopPingTimer();

            if (ws.value && connected.value) ws.value.close();
        });

        return {
            wsUrl,
            connected,
            form,
            placementsArray,
            toggleConnection,
            sendPlacement,
        };
    },
};

Vue.createApp(app).mount('#app');
