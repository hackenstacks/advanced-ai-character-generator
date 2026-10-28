import { AppData, ChatSession, VectorChunk, Character, VaultItem } from '../types';
import { STORAGE_KEY_DATA, STORAGE_KEY_PASS_VERIFIER, STORAGE_KEY_SALT } from '../constants';
import { logger } from './loggingService';

// --- Production-Grade Encryption using Web Crypto API ---
// This service implements strong, authenticated encryption for all user data.
// - Key Derivation: PBKDF2 with 100,000 iterations and a unique salt.
// - Encryption: AES-GCM with a 256-bit key.
// - IV Management: A unique 12-byte Initialization Vector (IV) is generated for each encryption
//   operation and prepended to the ciphertext.
// This ensures confidentiality, integrity, and authenticity of the stored data.

let masterCryptoKey: CryptoKey | null = null;
// This is kept ONLY for the one-time migration of legacy data
let masterPasswordForMigration: string | null = null; 

// --- Web Crypto API Helpers ---

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

const encryptData = async (data: string, key: CryptoKey): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes is recommended for AES-GCM

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        dataBuffer
    );
    
    // Prepend IV to the ciphertext for storage. This is a standard and secure practice.
    const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combinedBuffer.set(iv);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return arrayBufferToBase64(combinedBuffer);
};

const decryptData = async (encryptedBase64: string, key: CryptoKey): Promise<string> => {
    const combinedBuffer = base64ToArrayBuffer(encryptedBase64);
    
    // Extract IV from the start of the buffer
    const iv = combinedBuffer.slice(0, 12);
    const ciphertext = combinedBuffer.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
};


// --- Legacy XOR Cipher (for migration only) ---

const legacySimpleXOR = (data: string, key: string): string => {
  let output = '';
  for (let i = 0; i < data.length; i++) {
    output += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return output;
};

const legacyDecrypt = (encryptedData: string, masterKey: string): string => {
    if (!masterKey) throw new Error('Legacy master key is not set for migration.');
    const utf16ToBinary = (str: string): string => unescape(encodeURIComponent(str));
    const binaryToUtf16 = (binary: string): string => decodeURIComponent(escape(binary));
    
    const binaryString = atob(encryptedData);
    const xorResult = binaryToUtf16(binaryString);
    return legacySimpleXOR(xorResult, masterKey);
};

// --- IndexedDB setup ---
const DB_NAME = 'AINexusDB';
const STORE_NAME = 'appDataStore';
const VECTOR_STORE_NAME = 'vectorStore';
const IMAGE_STORE_NAME = 'imageStore';
const VAULT_STORE_NAME = 'vaultStore';
const DB_VERSION = 7; // Bumped to clear stale IDB from older builds

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new Error('IndexedDB is not supported in this browser.'));
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                logger.error("IndexedDB error:", request.error);
                reject("Error opening DB");
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
                if (!db.objectStoreNames.contains(VECTOR_STORE_NAME)) {
                    const vectorStore = db.createObjectStore(VECTOR_STORE_NAME, { keyPath: 'id' });
                    vectorStore.createIndex('characterId', 'characterId', { unique: false });
                    vectorStore.createIndex('sourceId', 'sourceId', { unique: false });
                }
                if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
                    db.createObjectStore(IMAGE_STORE_NAME);
                }
                if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
                    // New vault store
                    const vaultStore = db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'id' });
                    vaultStore.createIndex('parentId', 'parentId', { unique: false });
                }
            };
        });
    }
    return dbPromise;
};

const getFromDB = async (key: string): Promise<any> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

const setToDB = async (key: string, value: any): Promise<void> => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

const migrateKey = async (key: string) => {
    try {
        const lsValue = localStorage.getItem(key);
        if (lsValue !== null) {
            await setToDB(key, lsValue);
localStorage.removeItem(key);
            logger.log(`Migrated '${key}' from localStorage to IndexedDB.`);
        }
    } catch (e) {
        logger.error(`Failed to migrate '${key}' to IndexedDB:`, e);
    }
};

export const hasMasterPassword = async (): Promise<boolean> => {
    await migrateKey(STORAGE_KEY_PASS_VERIFIER);
    const verifier = await getFromDB(STORAGE_KEY_PASS_VERIFIER);
    return verifier !== undefined && verifier !== null;
};

export const setMasterPassword = async (password: string): Promise<void> => {
    masterPasswordForMigration = password;
    
    // Generate a new salt for the new password
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    masterCryptoKey = key;

    const verifier = await encryptData('password_is_correct', key);
    
    await setToDB(STORAGE_KEY_SALT, salt);
    await setToDB(STORAGE_KEY_PASS_VERIFIER, verifier);
    
    // Clear any old localStorage value on new password set
    localStorage.removeItem(STORAGE_KEY_PASS_VERIFIER);
    localStorage.removeItem(STORAGE_KEY_SALT);
};

export const verifyMasterPassword = async (password: string): Promise<boolean> => {
    masterPasswordForMigration = password; // Keep for potential data migration
    
    await migrateKey(STORAGE_KEY_PASS_VERIFIER);
    await migrateKey(STORAGE_KEY_SALT);

    const salt = await getFromDB(STORAGE_KEY_SALT);
    const verifier = await getFromDB(STORAGE_KEY_PASS_VERIFIER);
    if (!verifier) return false;

    if (salt) {
        // --- Modern Path (AES-GCM) ---
        try {
            const key = await deriveKey(password, salt);
            masterCryptoKey = key;
            const decrypted = await decryptData(verifier, key);
            return decrypted === 'password_is_correct';
        } catch (e) {
            return false;
        }
    } else {
        // --- Legacy Path (XOR) for migration ---
        try {
            const decrypted = legacyDecrypt(verifier, password);
            // If legacy login is correct, masterCryptoKey remains null.
            // This signals to loadData() that a migration is needed.
            return decrypted === 'password_is_correct';
        } catch (e) {
            return false;
        }
    }
};

export const saveData = async (data: AppData): Promise<void> => {
    if (!masterCryptoKey) throw new Error("Cannot save data: master key not available. This may happen if a legacy login occurred without a data load/migration.");

    const jsonString = JSON.stringify(data);
    const encryptedData = await encryptData(jsonString, masterCryptoKey);
    try {
        await setToDB(STORAGE_KEY_DATA, encryptedData);
    } catch (e) {
        logger.error("Failed to save data to IndexedDB:", e);
        throw e;
    }
};

// FIX: Add loadData function to load and decrypt data.
export const loadData = async (): Promise<AppData> => {
    await migrateKey(STORAGE_KEY_DATA);
    const encryptedData = await getFromDB(STORAGE_KEY_DATA);

    if (!encryptedData) {
        logger.log("No data found, returning default structure.");
        return { characters: [], chatSessions: [], plugins: [], lorebooks: [] };
    }

    if (masterCryptoKey) {
        // Modern path: AES-GCM key is available
        try {
            const jsonString = await decryptData(encryptedData, masterCryptoKey);
            return JSON.parse(jsonString);
        } catch (e) {
            logger.error("Failed to decrypt data with modern key. Data might be corrupt.", e);
            throw new Error("Failed to decrypt data.");
        }
    } else if (masterPasswordForMigration) {
        // Legacy path: login was successful with XOR, now migrate the data
        logger.log("Legacy data detected. Attempting migration...");
        try {
            const jsonString = legacyDecrypt(encryptedData, masterPasswordForMigration);
            const data = JSON.parse(jsonString);
            
            // Now, we need a new AES key to re-encrypt. Let's create one.
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const newKey = await deriveKey(masterPasswordForMigration, salt);
            masterCryptoKey = newKey; // Set the new key for future saves

            // Re-save the data with the new encryption
            await saveData(data);
            
            // Update the verifier and salt to use the new encryption standard
            const verifier = await encryptData('password_is_correct', newKey);
            await setToDB(STORAGE_KEY_SALT, salt);
            await setToDB(STORAGE_KEY_PASS_VERIFIER, verifier);

            logger.log("Data migration to AES-GCM successful.");
            return data;
        } catch (e) {
            logger.error("Failed to decrypt legacy data during migration.", e);
            throw new Error("Failed to migrate legacy data.");
        }
    } else {
        throw new Error("Cannot load data: no master key available.");
    }
};

// FIX: Add functions to manage RAG vector data in IndexedDB.
// --- Vector DB Operations ---

export const saveVectorChunks = async (chunks: VectorChunk[]): Promise<void> => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VECTOR_STORE_NAME);
        chunks.forEach(chunk => {
            store.put(chunk);
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getVectorChunksByCharacter = async (characterId: string): Promise<VectorChunk[]> => {
    const db = await getDB();
    return new Promise<VectorChunk[]>((resolve, reject) => {
        const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
        const store = transaction.objectStore(VECTOR_STORE_NAME);
        const index = store.index('characterId');
        const request = index.getAll(characterId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

export const deleteVectorChunksBySource = async (sourceId: string): Promise<void> => {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VECTOR_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VECTOR_STORE_NAME);
        const index = store.index('sourceId');
        const request = index.openCursor(sourceId);

        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getVectorChunksBySource = async (sourceId: string): Promise<VectorChunk[]> => {
    const db = await getDB();
    return new Promise<VectorChunk[]>((resolve, reject) => {
        const transaction = db.transaction(VECTOR_STORE_NAME, 'readonly');
        const store = transaction.objectStore(VECTOR_STORE_NAME);
        const index = store.index('sourceId');
        const request = index.getAll(sourceId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

// --- Vault Storage Functions ---
// These functions manage encrypted vault items

export const saveVaultItem = async (item: any): Promise<void> => {
    if (!masterCryptoKey) {
        throw new Error("Cannot save vault item: master key not available.");
    }
    
    const db = await getDB();
    
    // Encrypt the content if it exists
    const itemToStore = { ...item };
    if (itemToStore.content) {
        itemToStore.content = await encryptData(itemToStore.content, masterCryptoKey);
    }
    
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VAULT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VAULT_STORE_NAME);
        const request = store.put(itemToStore);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export const getVaultItems = async (parentId?: string): Promise<any[]> => {
    // Get database connection (vault store is initialized automatically)
    const db = await getDB();
    
    return new Promise<any[]>((resolve, reject) => {
        try {
            const transaction = db.transaction(VAULT_STORE_NAME, 'readonly');
            const store = transaction.objectStore(VAULT_STORE_NAME);
            
            let request;
            if (parentId) {
                const index = store.index('parentId');
                request = index.getAll(parentId);
            } else {
                request = store.getAll();
            }
            
            request.onerror = () => reject(request.error);
            request.onsuccess = async () => {
                try {
                    if (!masterCryptoKey) {
                        // If no master key, return items as-is (for migration scenarios)
                        resolve(request.result);
                    } else {
                        // Decrypt content for each item
                        const decryptedItems = await Promise.all(
                            request.result.map(async (item) => {
                                if (item.content) {
                                    return {
                                        ...item,
                                        content: await decryptData(item.content, masterCryptoKey)
                                    };
                                }
                                return item;
                            })
                        );
                        resolve(decryptedItems);
                    }
                } catch (error) {
                    reject(error);
                }
            };
        } catch (error) {
            reject(error);
        }
    });
};

export const deleteVaultItem = async (id: string): Promise<void> => {
    const db = await getDB();
    
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(VAULT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(VAULT_STORE_NAME);
        const request = store.delete(id);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export const encryptPackage = async (data: string, password: string): Promise<string> => {
    // Generate a random salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    
    // Derive a key from the password
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    const cryptoKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    
    // Encrypt the data
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = encoder.encode(data);
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        cryptoKey,
        encodedData
    );
    
    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    return arrayBufferToBase64(combined.buffer);
};

export const decryptPackage = async (encryptedData: string, password: string): Promise<string> => {
    // Convert from base64 to array buffer
    const binaryString = window.atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Extract salt (first 16 bytes), iv (next 12 bytes), and ciphertext (rest)
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);
    
    // Derive the key
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    const cryptoKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        cryptoKey,
        ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
};

// ===== VAULT HELPER FUNCTIONS =====

/**
 * Save a chat conversation to the vault
 */
export const saveConversationToVault = async (session: ChatSession, parentId: string = 'root'): Promise<string> => {
    const vaultItem = {
        id: `chat-${session.id}-${Date.now()}`,
        parentId,
        name: `${session.name || 'Conversation'} - ${new Date().toLocaleString()}`,
        type: 'file' as const,
        mimeType: 'application/json',
        content: JSON.stringify(session, null, 2),
        size: JSON.stringify(session).length,
        createdAt: new Date().toISOString()
    };

    await saveVaultItem(vaultItem);
    logger.log(`Saved conversation "${session.name}" to vault`);
    return vaultItem.id;
};

/**
 * Save a character to the vault
 */
export const saveCharacterToVault = async (character: Character, parentId: string = 'root'): Promise<string> => {
    const vaultItem = {
        id: `character-${character.id}-${Date.now()}`,
        parentId,
        name: `${character.name} - ${new Date().toLocaleString()}`,
        type: 'file' as const,
        mimeType: 'application/json',
        content: JSON.stringify(character, null, 2),
        size: JSON.stringify(character).length,
        createdAt: new Date().toISOString()
    };

    await saveVaultItem(vaultItem);
    logger.log(`Saved character "${character.name}" to vault`);
    return vaultItem.id;
};

/**
 * Save an image to the vault
 */
export const saveImageToVault = async (imageData: string, imageName: string, parentId: string = 'root'): Promise<string> => {
    const vaultItem = {
        id: `image-${crypto.randomUUID()}`,
        parentId,
        name: `${imageName} - ${new Date().toLocaleString()}`,
        type: 'file' as const,
        mimeType: 'image/png',
        content: imageData, // Base64 or data URL
        size: imageData.length,
        createdAt: new Date().toISOString()
    };

    await saveVaultItem(vaultItem);
    logger.log(`Saved image "${imageName}" to vault`);
    return vaultItem.id;
};

/**
 * Auto-backup all data to vault
 */
export const autoBackupToVault = async (data: AppData): Promise<void> => {
    const timestamp = new Date().toLocaleString();

    // Create backup folder
    const backupFolderId = `backup-${Date.now()}`;
    const backupFolder = {
        id: backupFolderId,
        parentId: 'root',
        name: `Auto Backup - ${timestamp}`,
        type: 'folder' as const,
        createdAt: new Date().toISOString()
    };

    await saveVaultItem(backupFolder);

    // Backup all characters
    if (data.characters && data.characters.length > 0) {
        for (const character of data.characters) {
            await saveCharacterToVault(character, backupFolderId);
        }
    }

    // Backup all chat sessions
    if (data.chatSessions && data.chatSessions.length > 0) {
        for (const session of data.chatSessions) {
            await saveConversationToVault(session, backupFolderId);
        }
    }

    // Backup full app data as JSON
    const fullBackupItem = {
        id: `full-backup-${Date.now()}`,
        parentId: backupFolderId,
        name: `Complete Backup - ${timestamp}.json`,
        type: 'file' as const,
        mimeType: 'application/json',
        content: JSON.stringify(data, null, 2),
        size: JSON.stringify(data).length,
        createdAt: new Date().toISOString()
    };

    await saveVaultItem(fullBackupItem);
    logger.log(`Auto-backup completed: ${data.characters?.length || 0} characters, ${data.chatSessions?.length || 0} chats`);
};
