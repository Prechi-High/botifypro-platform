$filePath = 'apps/bot-engine/src/commands.ts'
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Find the block: "  const keyboard: any[][] = []\r\n  for (const plan of pagePlans) {\r\n    keyboard.push([{ text: `..." 
# We'll search for the for-loop pattern and replace the whole block

$oldPattern = '  const keyboard: any\[\]\[\] = \[\]\r?\n  for \(const plan of pagePlans\) \{\r?\n    keyboard\.push\(\[\{ text: `.+?` \}\]\)\r?\n  \}'
$newText = "  const keyboard: any[][] = []`r`n  // Show plans 3 per row side by side`r`n  const COLS = 3`r`n  for (let i = 0; i < pagePlans.length; i += COLS) {`r`n    keyboard.push(`r`n      pagePlans.slice(i, i + COLS).map((plan: any) => ({ text: '💎 ' + plan.name + ' — ' + plan.activationAmount }))`r`n    )`r`n  }"

$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $oldPattern, $newText, [System.Text.RegularExpressions.RegexOptions]::Singleline)

if ($newContent -eq $content) {
    Write-Output "NO MATCH - replacement not made"
} else {
    [System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Output "SUCCESS - replacement made"
}
