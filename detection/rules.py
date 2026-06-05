def check_event(event_text):

    event_text = event_text.lower()

    if "powershell" in event_text:
        return "HIGH", "PowerShell Execution Detected"

    if "cmd.exe" in event_text:
        return "MEDIUM", "Command Prompt Execution"

    return None