from pathlib import Path

way = Path("C:/Users/akash/OneDrive/Documents/web_dev/just_for_fun/yoo_win/backend")

with open('file.txt', 'w', encoding='utf-8') as f:  # Open in write mode with UTF-8 encoding
    for file_path in way.rglob("*.py"):  # Iterate over all Python files
        f.write(f"--- Content of: {file_path} ---\n")  # Add a header for clarity
        with open(file_path, 'r', encoding='utf-8') as py_file:
            f.write(py_file.read())  # Write the file content
        f.write("\n\n")  # Add space between files
