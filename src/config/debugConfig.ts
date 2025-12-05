// ============================================
// CONFIGURATION DU MODE DEBUG
// ============================================
// Modifiez ce paramètre pour activer/désactiver les messages console

/**
 * Mode Debug
 * - true : Affiche tous les messages dans la console du navigateur
 * - false : Désactive tous les messages console (mode production)
 */
export const DEBUG_MODE = false;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Console.log wrapper qui respecte le mode debug
 */
export const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

/**
 * Console.error wrapper qui respecte le mode debug
 */
export const debugError = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.error(...args);
  }
};

/**
 * Console.warn wrapper qui respecte le mode debug
 */
export const debugWarn = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.warn(...args);
  }
};

/**
 * Console.info wrapper qui respecte le mode debug
 */
export const debugInfo = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.info(...args);
  }
};

/**
 * Console.table wrapper qui respecte le mode debug
 */
export const debugTable = (data: any) => {
  if (DEBUG_MODE) {
    console.table(data);
  }
};

/**
 * Console.group wrapper qui respecte le mode debug
 */
export const debugGroup = (label?: string) => {
  if (DEBUG_MODE) {
    console.group(label);
  }
};

/**
 * Console.groupEnd wrapper qui respecte le mode debug
 */
export const debugGroupEnd = () => {
  if (DEBUG_MODE) {
    console.groupEnd();
  }
};
