@echo off
title VoiceKey AI Blind Assistant Launcher
echo ===================================================
echo   VoiceKey AI Assistant - Blind Student Launcher
echo ===================================================
echo.
echo Speaking launch announcement via Windows Audio TTS...
powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('Launching VoiceKey A I Assistant for blind examinees. Please wait.')"

echo Opening VoiceKey AI Assistant in browser...
start http://localhost:5173/

echo.
echo VoiceKey AI Assistant launched successfully!
