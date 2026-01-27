import {Contact} from "./contacts.ts";
import {generateMessageHash, Message} from "./messages.ts";
import {toUtf8} from "../utils.ts";

export async function loadMockData(
    dispatchContacts: (action: any) => Promise<void>,
    dispatchMessages: (action: any) => Promise<void>
) {
    const contacts: Contact[] = [
        {
            pubkey: '0aGF0ZG91YnRiYW5kd2hlcmVhcHBsZWFjcm9zc2Nvc3Q=',
            name: 'Alice 🌿', is_blocked: false, is_muted: false, is_pinned: true, pow: 12
        },
        {
            pubkey: '0bGlnaHRtZWV0dGhyb2F0YnVzaGZ1dHVyZXRyb29wc3Q=',
            name: 'Bob (Work)', is_blocked: false, is_muted: false, is_pinned: false, pow: 8
        },
        {
            pubkey: '0Ym90dG9tY29tcGFyZXRpZ2h0bHl3b21lbmxlYXZpbmc=',
            name: 'Charlie', is_blocked: false, is_muted: false, is_pinned: false, pow: 10
        },
        {
            pubkey: '0ZmFjdG9yeXN1cmZhY2VkYXVnaHRlcmNvbnNpc3R0b24=',
            name: 'Dave 🧊', is_blocked: false, is_muted: true, is_pinned: false, pow: 15
        },
        {
            pubkey: '0Y29zdHNjaWVudGlzdGdldHNhZmV0b3BsYWluc2FsdHM=',
            name: 'Eve', is_blocked: true, is_muted: false, is_pinned: false, pow: 20
        },
        {
            pubkey: '0bGVzc29uc3lzdGVtZnJhbWVzY2llbnRpZmljY2hvc2U=',
            name: 'Franky', is_blocked: false, is_muted: false, is_pinned: false, pow: 5
        },

        {
            pubkey: '1Z2F2ZWxvbmVseWhpbXNlbGZjcnlwYWNrYWdlaGVscHo=',
            name: 'Local School Hub 🏫', is_blocked: false, is_muted: false, is_pinned: true, pow: 0
        },
        {
            pubkey: '1ZG9ua2V5ZG90aWxsY2hhcnRmYWlybHlzd2lteW91dGg=',
            name: 'AURA Community (Global)', is_blocked: false, is_muted: false, is_pinned: false, pow: 0
        },
    ];

    const now = Date.now();
    const messages: Message[] = [];

    const aliceMessages = [
        { text: "Hey! How is the Aura project going?", inc: true, offset: 3600000 },
        { text: "It's coming along great! Just finished the P2P layer 🚀", inc: false, offset: 3500000 },
        { text: "That sounds amazing. Can we test the offline sync tomorrow?", inc: true, offset: 3400000 },
        { text: "Sure! I've implemented the bloom filters for efficient sync. It should be very fast now.", inc: false, offset: 3000000 },
        { text: "Great. Don't forget to check the encryption overhead on older devices 📱", inc: true, offset: 2500000 },
        { text: "Already on it. Performance is steady at 60fps even during heavy sync.", inc: false, offset: 2000000 },
        { text: "Everything is encrypted with XSalsa20-Poly1305, so security is tight. 🔐", inc: false, offset: 1500000 },
        { text: "Perfect. See you tomorrow then! 👋", inc: true, offset: 1000000 },
        { text: "Wait, I just pushed the new build to the mesh. Check it out!", inc: false, offset: 800000 },
        { text: "Actually, one more thing... did you see the new UI mockups? 😍", inc: true, offset: 500000, read: false },
    ];

    aliceMessages.forEach(m => {
        const msg: Message = {
            contact: contacts[0].pubkey,
            content: toUtf8(m.text),
            sent_time: now - m.offset,
            arrive_time: now - m.offset + 100,
            incoming: m.inc,
            read: m.read ?? true,
            status: "sent",
            hash: ""
        };
        msg.hash = generateMessageHash(msg);
        messages.push(msg);
    });

    const schoolMessages = [
        { text: "System: Welcome to the Local School Hub. Stay updated on campus events!", time: now - 86400000 },
        { text: "Reminder: Physics club starts in 15 minutes in Room 402.", time: now - 7200000 },
        { text: "Did anyone find a blue hoodie in the gym?", time: now - 3600000 },
        { text: "The cafeteria is serving tacos today! 🌮🔥", time: now - 600000 },
    ];

    schoolMessages.forEach(m => {
        const msg: Message = {
            contact: contacts[6].pubkey,
            content: toUtf8(m.text),
            sent_time: m.time,
            arrive_time: m.time + 10,
            incoming: true,
            read: false,
            status: "sent",
            hash: ""
        };
        msg.hash = generateMessageHash(msg);
        messages.push(msg);
    });

    const otherChats = [
        { pk: contacts[1].pubkey, text: "The report is ready, check it whenever you're back on the mesh.", inc: true, read: false, time: now - 120000 },
        { pk: contacts[2].pubkey, text: "Pizza tonight? 🍕 I'm starving!", inc: true, read: true, time: now - 7200000 },
        { pk: contacts[3].pubkey, text: "I'm heading out now. Signal might be weak in the subway. See ya!", inc: false, read: true, time: now - 18000000 },
        { pk: contacts[5].pubkey, text: "Can you send me your new pubkey? I lost the sync.", inc: true, read: false, time: now - 30000 },
        { pk: contacts[7].pubkey, text: "Welcome to AURA! This is a global broadcast channel.", inc: true, read: true, time: now - 30000000 },
    ];

    otherChats.forEach(m => {
        const msg: Message = {
            contact: m.pk,
            content: toUtf8(m.text),
            sent_time: m.time,
            arrive_time: m.time + 50,
            incoming: m.inc,
            read: m.read,
            status: "sent",
            hash: ""
        };
        msg.hash = generateMessageHash(msg);
        messages.push(msg);
    });

    await dispatchContacts({ action: 'clear' });
    await dispatchMessages({ type: 'wipe' });

    for (const c of contacts) {
        await dispatchContacts({ action: 'add', payload: c });
    }

    for (const m of messages) {
        await dispatchMessages({ type: 'insert', payload: m });
    }

    console.log("AURA Mock Data: Done. Keys are mixed, channels added.");
}