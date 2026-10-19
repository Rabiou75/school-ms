!macro customHeader
  BrandingText "ETS IUTECH CONSULTING"
!macroend

!macro customInit
  nsExec::Exec 'taskkill /F /IM "School MS.exe" /T'
  nsExec::Exec 'taskkill /F /IM "School MS Helper.exe" /T'
  nsExec::Exec 'taskkill /F /IM "School MS Helper (GPU).exe" /T'
  nsExec::Exec 'taskkill /F /IM "School MS Helper (Renderer).exe" /T'
  nsExec::Exec 'taskkill /F /IM "postgres.exe" /T'
  nsExec::Exec 'taskkill /F /IM "pg_ctl.exe" /T'
  Sleep 1500
!macroend

!macro customInstall
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 != 1
    DetailPrint "Installing Visual C++ Runtime..."
    ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart' $1
  ${EndIf}
!macroend
