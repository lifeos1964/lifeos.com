import { state } from './state.js';
import { showToast } from './utils.js';

const notifiedEventIds = new Set();
let nativeNotifications;
let reminderInterval;

export function initReminders() {
    if (reminderInterval) return;
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    checkEvents();
    reminderInterval = setInterval(checkEvents, 20000);
    window.addEventListener('lifeos:events-changed', scheduleNativeReminders);
    initNativeReminders();
}

async function initNativeReminders() {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        nativeNotifications = LocalNotifications;
        const permission = await nativeNotifications.checkPermissions();
        if (permission.display === 'prompt') await nativeNotifications.requestPermissions();
        const exactAlarmPermission = await nativeNotifications.checkExactNotificationSetting();
        if (exactAlarmPermission.exact_alarm !== 'granted') {
            await nativeNotifications.changeExactNotificationSetting();
        }
        await scheduleNativeReminders();
    } catch (error) {
        console.warn('Native event alarms are unavailable:', error);
    }
}

async function scheduleNativeReminders() {
    if (!nativeNotifications) return;
    const permission = await nativeNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    const pending = await nativeNotifications.getPending();
    const notificationIds = pending.notifications
        .filter(notification => notification.extra?.source === 'lifeos-calendar')
        .map(notification => ({ id: notification.id }));
    if (notificationIds.length) await nativeNotifications.cancel({ notifications: notificationIds });

    const now = new Date();
    const notifications = state.events.flatMap(event => {
        if (event.alarmEnabled === false) return [];
        const eventDate = parseEventDateTime(event);
        if (!eventDate) return [];
        const alarmDate = new Date(eventDate.getTime() - Number(event.reminder ?? 10) * 60000);
        if (alarmDate <= now) return [];
        const minutes = Number(event.reminder ?? 10);
        const body = minutes > 0
            ? `${event.title} starts in ${minutes} minute${minutes === 1 ? '' : 's'} at ${event.location}.`
            : `${event.title} is happening now at ${event.location}.`;
        return [{
            id: getNotificationId(event.id),
            title: 'Event Reminder',
            body,
            schedule: { at: alarmDate, allowWhileIdle: true },
            extra: { source: 'lifeos-calendar' },
        }];
    });
    if (notifications.length) await nativeNotifications.schedule({ notifications });
}

function getNotificationId(eventId) {
    return Math.abs(String(eventId).split('').reduce((hash, character) => {
        return ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    }, 0)) || 1;
}

function checkEvents() {
    const now = new Date();
    state.events.forEach(ev => {
        if (notifiedEventIds.has(ev.id)) return;
        const eventDate = parseEventDateTime(ev);
        if (!eventDate) return;

        const reminderMinutes = Number(ev.reminder ?? 10);
        const alarmTime = new Date(eventDate.getTime() - reminderMinutes * 60000);
        const diff = now - alarmTime;
        // Fire once the reminder time has arrived, within a 1-minute window
        if (diff >= 0 && diff < 60000) {
            notifiedEventIds.add(ev.id);
            triggerAlarm(ev, reminderMinutes);
        }
    });
}

function parseEventDateTime(ev) {
    if (!ev.date || !ev.time) return null;
    const match = /(\d+):(\d+)\s*(AM|PM)/i.exec(ev.time);
    if (!match) return null;
    let [, h, m, period] = match;
    h = Number(h);
    m = Number(m);
    if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    const [y, mo, d] = ev.date.split('-').map(Number);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d, h, m, 0);
}

function triggerAlarm(ev, reminderMinutes) {
    const message = reminderMinutes > 0
        ? `⏰ Reminder: "${ev.title}" starts in ${reminderMinutes} minute${reminderMinutes === 1 ? '' : 's'} at ${ev.location}!`
        : `⏰ Reminder: "${ev.title}" is happening now at ${ev.location}!`;
    showToast(message);

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Event Reminder', { body: `${ev.title} — ${ev.time} at ${ev.location}` });
    }

    if (ev.alarmEnabled !== false) playAlarm(ev.alarmSound);
}

function playAlarm(alarmSound) {
    if (alarmSound?.type === 'mp3' && alarmSound.data) {
        const audio = new Audio(alarmSound.data);
        audio.play().catch(() => playDeviceBeep());
        return;
    }
    playDeviceBeep();
}

function playDeviceBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
        // Audio not available in this environment
    }
}
