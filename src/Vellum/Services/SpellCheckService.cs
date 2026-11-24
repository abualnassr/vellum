using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Vellum.Models;

namespace Vellum.Services;

public sealed partial class SpellCheckService : IDisposable
{
    private enum CorrectiveAction
    {
        None = 0,
        GetSuggestions = 1,
        Replace = 2,
        Delete = 3,
    }

    [ComImport, Guid("B7C82D61-FBE8-4B47-9B27-6C0D2E0DE0A3"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISpellingError
    {
        [PreserveSig] int get_StartIndex(out uint value);
        [PreserveSig] int get_Length(out uint value);
        [PreserveSig] int get_CorrectiveAction(out CorrectiveAction value);
        [PreserveSig] int get_Replacement([MarshalAs(UnmanagedType.LPWStr)] out string value);
    }

    [ComImport, Guid("803E3BD4-2828-4410-8290-418D1D73C762"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEnumSpellingError
    {
        [PreserveSig] int Next([MarshalAs(UnmanagedType.Interface)] out ISpellingError value);
    }

    [ComImport, Guid("00000101-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEnumString
    {
        [PreserveSig] int Next(int celt, [MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPWStr, SizeParamIndex = 0), Out] string[] rgelt, out int pceltFetched);
        [PreserveSig] int Skip(int celt);
        [PreserveSig] int Reset();
        [PreserveSig] int Clone(out IEnumString ppenum);
    }

    [ComImport, Guid("B6FD0B71-E2BC-4653-8D05-F197E412770B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISpellChecker
    {
        [PreserveSig] int get_LanguageTag([MarshalAs(UnmanagedType.LPWStr)] out string value);
        [PreserveSig] int Check([MarshalAs(UnmanagedType.LPWStr)] string text, [MarshalAs(UnmanagedType.Interface)] out IEnumSpellingError value);
        [PreserveSig] int Suggest([MarshalAs(UnmanagedType.LPWStr)] string word, [MarshalAs(UnmanagedType.Interface)] out IEnumString value);
        [PreserveSig] int Add([MarshalAs(UnmanagedType.LPWStr)] string word);
        [PreserveSig] int Ignore([MarshalAs(UnmanagedType.LPWStr)] string word);
        [PreserveSig] int AutoCorrect([MarshalAs(UnmanagedType.LPWStr)] string from, [MarshalAs(UnmanagedType.LPWStr)] string to);
        [PreserveSig] int GetOptionValue([MarshalAs(UnmanagedType.LPWStr)] string optionId, out byte value);
        [PreserveSig] int get_OptionIds([MarshalAs(UnmanagedType.Interface)] out IEnumString value);
        [PreserveSig] int get_Id([MarshalAs(UnmanagedType.LPWStr)] out string value);
        [PreserveSig] int get_LocalizedName([MarshalAs(UnmanagedType.LPWStr)] out string value);
        [PreserveSig] int add_SpellCheckerChanged(IntPtr handler, out ulong eventCookie);
        [PreserveSig] int remove_SpellCheckerChanged(ulong eventCookie);
        [PreserveSig] int GetOptionDescription([MarshalAs(UnmanagedType.LPWStr)] string optionId, out IntPtr value);
        [PreserveSig] int ComprehensiveCheck([MarshalAs(UnmanagedType.LPWStr)] string text, [MarshalAs(UnmanagedType.Interface)] out IEnumSpellingError value);
    }

    [ComImport, Guid("8E018A9D-2415-4677-BF08-794EA61F94BB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface ISpellCheckerFactory
    {
        [PreserveSig] int get_SupportedLanguages([MarshalAs(UnmanagedType.Interface)] out IEnumString value);
        [PreserveSig] int IsSupported([MarshalAs(UnmanagedType.LPWStr)] string languageTag, out int value);
        [PreserveSig] int CreateSpellChecker([MarshalAs(UnmanagedType.LPWStr)] string languageTag, [MarshalAs(UnmanagedType.Interface)] out ISpellChecker value);
    }

    [ComImport, Guid("7AB36653-1796-484B-BDFA-E74F1DB7C1DC")]
    private class SpellCheckerFactoryClass { }

    private readonly object _sync = new();
    private readonly Dictionary<string, ISpellChecker> _checkers = new(StringComparer.OrdinalIgnoreCase);
    private ISpellCheckerFactory? _factory;
    private SpellLanguagesInfo? _cachedLanguages;

    [GeneratedRegex(@"^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)", RegexOptions.Compiled)]
    private static partial Regex FrontmatterRegex();

    [GeneratedRegex(@"^([ \t]{0,3})(```|~~~)[^\r\n]*$", RegexOptions.Multiline | RegexOptions.Compiled)]
    private static partial Regex FenceLineRegex();

    [GeneratedRegex(@"\$\$[\s\S]*?\$\$", RegexOptions.Compiled)]
    private static partial Regex BlockMathRegex();

    [GeneratedRegex(@"(?<![\\$])\$(?!\s)(?:\\.|[^$\r\n])+?(?<!\s)\$", RegexOptions.Compiled)]
    private static partial Regex InlineMathRegex();

    [GeneratedRegex(@"`+[^`\r\n]+?`+", RegexOptions.Compiled)]
    private static partial Regex InlineCodeRegex();

    [GeneratedRegex(@"\]\([^\)\r\n]+\)", RegexOptions.Compiled)]
    private static partial Regex LinkDestRegex();

    [GeneratedRegex(@"\b(?:https?|mailto):[^\s<>\)\]]+", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex UrlRegex();

    [GeneratedRegex(@"<[^>\r\n]+>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex AlertMarkerRegex();

    public static string MaskMarkdownForSpellCheck(string markdown)
    {
        if (string.IsNullOrEmpty(markdown)) return string.Empty;

        char[] buf = markdown.ToCharArray();

        static void BlankRange(char[] arr, int start, int length)
        {
            int end = Math.Min(arr.Length, start + length);
            for (int i = Math.Max(0, start); i < end; i++)
            {
                if (arr[i] != '\r' && arr[i] != '\n')
                {
                    arr[i] = ' ';
                }
            }
        }

        // 1. YAML frontmatter
        var fm = FrontmatterRegex().Match(markdown);
        if (fm.Success)
        {
            BlankRange(buf, fm.Index, fm.Length);
        }

        // 2. Fenced code blocks (``` or ~~~)
        var fenceMatches = FenceLineRegex().Matches(markdown);
        int i = 0;
        while (i < fenceMatches.Count)
        {
            var open = fenceMatches[i];
            string marker = open.Groups[2].Value;
            int closeIdx = -1;
            for (int j = i + 1; j < fenceMatches.Count; j++)
            {
                if (fenceMatches[j].Groups[2].Value[0] == marker[0])
                {
                    closeIdx = j;
                    break;
                }
            }

            if (closeIdx != -1)
            {
                var close = fenceMatches[closeIdx];
                BlankRange(buf, open.Index, (close.Index + close.Length) - open.Index);
                i = closeIdx + 1;
            }
            else
            {
                BlankRange(buf, open.Index, markdown.Length - open.Index);
                break;
            }
        }

        // 3. Mask inline code, math, links, URLs, HTML tags, and alert markers
        string pass = new string(buf);
        Regex[] maskPatterns =
        {
            InlineCodeRegex(),
            BlockMathRegex(),
            InlineMathRegex(),
            LinkDestRegex(),
            UrlRegex(),
            HtmlTagRegex(),
            AlertMarkerRegex(),
        };

        foreach (var regex in maskPatterns)
        {
            foreach (Match m in regex.Matches(pass))
            {
                BlankRange(buf, m.Index, m.Length);
            }
        }

        return new string(buf);
    }

    public SpellLanguagesInfo GetLanguages()
    {
        lock (_sync)
        {
            if (_cachedLanguages != null) return _cachedLanguages;

            var available = new List<string>();
            try
            {
                EnsureFactory();
                if (_factory != null && _factory.get_SupportedLanguages(out var enumStr) == 0 && enumStr != null)
                {
                    try
                    {
                        var buf = new string[1];
                        while (enumStr.Next(1, buf, out int fetched) == 0 && fetched == 1)
                        {
                            if (!string.IsNullOrWhiteSpace(buf[0]))
                            {
                                available.Add(buf[0]);
                            }
                        }
                    }
                    finally
                    {
                        Marshal.ReleaseComObject(enumStr);
                    }
                }
            }
            catch
            {
                // Return empty if Windows Spell Checker is unavailable
            }

            string? en = available.FirstOrDefault(l => l.Equals("en-US", StringComparison.OrdinalIgnoreCase))
                ?? available.FirstOrDefault(l => l.StartsWith("en", StringComparison.OrdinalIgnoreCase));
            string? ar = available.FirstOrDefault(l => l.Equals("ar-SA", StringComparison.OrdinalIgnoreCase))
                ?? available.FirstOrDefault(l => l.StartsWith("ar", StringComparison.OrdinalIgnoreCase));

            _cachedLanguages = new SpellLanguagesInfo
            {
                Available = available,
                ActiveEnglish = en,
                ActiveArabic = ar,
            };
            return _cachedLanguages;
        }
    }

    public List<SpellIssue> CheckText(string markdown, string language = "auto", int maxIssues = 200)
    {
        var results = new List<SpellIssue>();
        if (string.IsNullOrWhiteSpace(markdown)) return results;

        string masked = MaskMarkdownForSpellCheck(markdown);
        var langs = GetLanguages();

        lock (_sync)
        {
            if (string.Equals(language, "auto", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrEmpty(langs.ActiveEnglish) && ContainsLatinLetters(masked))
                {
                    string latinOnly = KeepScriptPreservingOffsets(masked, keepArabic: false);
                    CheckWithLanguageLocked(markdown, latinOnly, langs.ActiveEnglish, results, maxIssues);
                }

                if (!string.IsNullOrEmpty(langs.ActiveArabic) && ContainsArabicLetters(masked) && results.Count < maxIssues)
                {
                    string arabicOnly = KeepScriptPreservingOffsets(masked, keepArabic: true);
                    CheckWithLanguageLocked(markdown, arabicOnly, langs.ActiveArabic, results, maxIssues);
                }
            }
            else
            {
                string? target = langs.Available.FirstOrDefault(l => l.Equals(language, StringComparison.OrdinalIgnoreCase))
                    ?? (language.StartsWith("ar", StringComparison.OrdinalIgnoreCase) ? langs.ActiveArabic : langs.ActiveEnglish);

                if (!string.IsNullOrEmpty(target))
                {
                    CheckWithLanguageLocked(markdown, masked, target, results, maxIssues);
                }
            }
        }

        results.Sort((a, b) => a.Start.CompareTo(b.Start));
        return results;
    }

    public void AddToDictionary(string word, string language)
    {
        if (string.IsNullOrWhiteSpace(word)) return;
        string targetLang = ResolveTargetLanguage(word, language);
        lock (_sync)
        {
            var checker = GetOrCreateCheckerLocked(targetLang);
            checker?.Add(word);
        }
    }

    public void IgnoreWord(string word, string language)
    {
        if (string.IsNullOrWhiteSpace(word)) return;
        string targetLang = ResolveTargetLanguage(word, language);
        lock (_sync)
        {
            var checker = GetOrCreateCheckerLocked(targetLang);
            checker?.Ignore(word);
        }
    }

    private string ResolveTargetLanguage(string word, string requested)
    {
        var langs = GetLanguages();
        if (!string.IsNullOrWhiteSpace(requested) && !requested.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            return requested;
        }
        return ContainsArabicLetters(word)
            ? (langs.ActiveArabic ?? langs.ActiveEnglish ?? "ar-SA")
            : (langs.ActiveEnglish ?? langs.ActiveArabic ?? "en-US");
    }

    private void CheckWithLanguageLocked(
        string original,
        string prepared,
        string langTag,
        List<SpellIssue> output,
        int maxIssues
    )
    {
        var checker = GetOrCreateCheckerLocked(langTag);
        if (checker == null) return;

        IEnumSpellingError? enumErr = null;
        try
        {
            if (checker.Check(prepared, out enumErr) != 0 || enumErr == null) return;

            while (output.Count < maxIssues && enumErr.Next(out var err) == 0 && err != null)
            {
                try
                {
                    err.get_CorrectiveAction(out var action);
                    if (action == CorrectiveAction.None) continue;

                    err.get_StartIndex(out uint start);
                    err.get_Length(out uint len);
                    if (len == 0 || start + len > original.Length) continue;

                    string word = original.Substring((int)start, (int)len);
                    var suggestions = new List<string>(6);

                    if (action == CorrectiveAction.Replace &&
                        err.get_Replacement(out string rep) == 0 &&
                        !string.IsNullOrEmpty(rep))
                    {
                        suggestions.Add(rep);
                    }

                    if (checker.Suggest(word, out var sugEnum) == 0 && sugEnum != null)
                    {
                        try
                        {
                            var buf = new string[1];
                            while (suggestions.Count < 6 && sugEnum.Next(1, buf, out int got) == 0 && got == 1)
                            {
                                string s = buf[0];
                                if (!string.IsNullOrEmpty(s) && !suggestions.Contains(s, StringComparer.Ordinal))
                                {
                                    suggestions.Add(s);
                                }
                            }
                        }
                        finally
                        {
                            Marshal.ReleaseComObject(sugEnum);
                        }
                    }

                    output.Add(new SpellIssue
                    {
                        Start = (int)start,
                        Length = (int)len,
                        Word = word,
                        Language = langTag,
                        Suggestions = suggestions,
                    });
                }
                finally
                {
                    Marshal.ReleaseComObject(err);
                }
            }
        }
        catch
        {
            // Skip transient COM spellcheck issues gracefully
        }
        finally
        {
            if (enumErr != null) Marshal.ReleaseComObject(enumErr);
        }
    }

    private ISpellChecker? GetOrCreateCheckerLocked(string langTag)
    {
        if (_checkers.TryGetValue(langTag, out var cached)) return cached;

        try
        {
            EnsureFactory();
            if (_factory == null) return null;
            if (_factory.IsSupported(langTag, out int supported) != 0 || supported == 0) return null;
            if (_factory.CreateSpellChecker(langTag, out var checker) == 0 && checker != null)
            {
                _checkers[langTag] = checker;
                return checker;
            }
        }
        catch
        {
            // Ignore unsupported language
        }

        return null;
    }

    private void EnsureFactory()
    {
        _factory ??= (ISpellCheckerFactory)new SpellCheckerFactoryClass();
    }

    private static bool IsArabicChar(char c)
    {
        return (c >= '\u0600' && c <= '\u06FF')
            || (c >= '\u0750' && c <= '\u077F')
            || (c >= '\u08A0' && c <= '\u08FF')
            || (c >= '\uFB50' && c <= '\uFDFF')
            || (c >= '\uFE70' && c <= '\uFEFF');
    }

    private static bool ContainsArabicLetters(string text)
    {
        foreach (char c in text)
        {
            if (IsArabicChar(c)) return true;
        }
        return false;
    }

    private static bool ContainsLatinLetters(string text)
    {
        foreach (char c in text)
        {
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) return true;
        }
        return false;
    }

    private static string KeepScriptPreservingOffsets(string masked, bool keepArabic)
    {
        char[] arr = masked.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
        {
            char c = arr[i];
            if (keepArabic)
            {
                if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
                {
                    arr[i] = ' ';
                }
            }
            else
            {
                if (IsArabicChar(c))
                {
                    arr[i] = ' ';
                }
            }
        }
        return new string(arr);
    }

    public void Dispose()
    {
        lock (_sync)
        {
            foreach (var checker in _checkers.Values)
            {
                try { Marshal.ReleaseComObject(checker); } catch { }
            }
            _checkers.Clear();

            if (_factory != null)
            {
                try { Marshal.ReleaseComObject(_factory); } catch { }
                _factory = null;
            }
        }
    }
}
