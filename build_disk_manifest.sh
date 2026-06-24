#!/usr/bin/env bash

# This script build disk/manifest.json from the list of files located in the ./disk/
# directory.

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <new version (Major.Minor.Patch)>" >&2
    exit 1
fi

version="$1"
disk_dir="./disk"
manifest="$disk_dir/manifest.json"

first_item=true

echo "{" > "$manifest"
echo "  \"_version\": \"$version\"," >> "$manifest"

while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    if [[ "$filename" == manifest.json* ]]; then
        continue
    fi
    if [ "$first_item" = true ]; then
      first_item=false
    else
      echo "," >> "$manifest"
    fi
    file_loc="${file#$disk_dir}"
    printf '  "%s": "%s"'  "$file_loc" "${file_loc#/}" >> "$manifest"
done < <(find "$disk_dir" -type f -print0 | sort -z)

echo "" >> "$manifest"
echo "}" >> "$manifest"
