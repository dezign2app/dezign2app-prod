/**
 * Utility functions for terminal text processing and clipboard copying.
 */

/**
 * Strips ANSI escape sequences, terminal control characters, and orphaned CSI codes
 * from terminal output while preserving spaces, tabs, and newlines.
 */
export function cleanTerminalText(text: string): string {
  if (!text) return "";

  return (
    text
      // 1. Normalize CRLF to LF
      .replace(/\r\n/g, "\n")
      // 2. Strip standard ANSI / VT100 / xterm escape sequences (with ESC byte: \x1b, \u001b, \u009b)
      .replace(
        /(?:\x1b|\u001b|\u009b)(?:\[[0-9:;<=>?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\|$)|[PX^_][^\x1b]*(?:\x07|\x1b\\|$)|[\(\)\*#%+-./][0-9A-Za-z]|[@-Z\\-_c])/g,
        "",
      )
      // 3. Strip orphaned / naked ANSI escape codes (missing the ESC byte)
      .replace(/\[[0-2]?[KJ]/g, "") // Clear line / display: [K, [0K, [2K, [J, etc.
      .replace(/\[(?:\d+(?:;\d+)*)?m/g, "") // SGR styling: [m, [0m, [1;31m, [41;97m, etc.
      .replace(/\[\?[0-9]+[a-zA-Z]/g, "") // Private modes: [?25h, [?25l, etc.
      .replace(/\[\d+(?:;\d+)*[a-zA-Z]/g, "") // Cursor positioning: [1G, [2A, [10;20H, etc.
      // 4. Strip non-printable ASCII control characters except tab (\t) and newline (\n)
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      // 5. Normalize standalone carriage returns
      .replace(/\r/g, "\n")
  );
}
