import subprocess

command = [
    "powershell",
    "-Command",
    "Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents 5"
]

result = subprocess.run(
    command,
    capture_output=True,
    text=True
)

print("STDOUT:")
print(result.stdout)

print("\nSTDERR:")
print(result.stderr)

print("\nRETURN CODE:")
print(result.returncode)