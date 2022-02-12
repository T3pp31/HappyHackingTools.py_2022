import pyshark

cap = pyshark.LiveCapture(interface='en0')
cap.sniff(timeout=5)

print(cap[1])