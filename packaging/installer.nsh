; Instrumenta uses one stable per-user app ID. electron-builder will replace the
; existing installation during an upgrade; this prompt makes that behavior
; explicit and gives a user a safe cancel point. App data is intentionally kept.
!macro customInit
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\instrumenta-launcher\Instrumenta.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "An older Instrumenta installation was found. Continue and replace it with Instrumenta ${VERSION}? Your settings and documents will be preserved." IDYES +2
    Abort
  ${EndIf}
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Instrumenta\Instrumenta.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "An older Instrumenta installation was found. Continue and replace it with Instrumenta ${VERSION}? Your settings and documents will be preserved." IDYES +2
    Abort
  ${EndIf}
!macroend
