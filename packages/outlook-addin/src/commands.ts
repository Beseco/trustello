// Commands-Seite: Ribbon-Button-Handler für "Sicher senden"
// Diese Datei wird als separates Entry-Point geladen (kein React).
Office.onReady(() => {
  // Funktion wird vom Manifest als FunctionName registriert
  Office.actions.associate("openTaskpane", openTaskpane);
});

function openTaskpane(event: Office.AddinCommands.Event) {
  Office.context.ui.displayDialogAsync(
    window.location.origin + "/taskpane.html",
    { height: 60, width: 30, displayInIframe: true },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.error("Taskpane konnte nicht geöffnet werden:", result.error.message);
      }
    },
  );
  event.completed();
}
