import sys

def find_non_ascii(filename):
    try:
        with open(filename, 'rb') as f:
            content = f.read()
            lines = content.split(b'\n')
            for i, line in enumerate(lines):
                for j, byte in enumerate(line):
                    if byte > 127:
                        print(f"Line {i+1}, Column {j+1}: Byte {hex(byte)} (Char: {line[j:j+3].decode('utf-8', errors='ignore')})")
                        # Break after first byte of a multi-byte char to avoid spam
                        break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        find_non_ascii(sys.argv[1])
    else:
        print("Usage: python find_non_ascii.py <filename>")
