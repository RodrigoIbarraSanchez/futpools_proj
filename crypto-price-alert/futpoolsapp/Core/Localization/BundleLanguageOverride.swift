//
//  BundleLanguageOverride.swift
//  futpoolsapp
//
//  Swizzle `Bundle.main` so its `localizedString(forKey:value:table:)`
//  reads from a user-selected language bundle instead of the OS-level
//  preferred language. Wires up the in-app language picker in
//  SettingsView (`@AppStorage("app_language")`) without requiring an
//  app restart.
//
//  Without this, `String(localized: "key")` always uses the device
//  language — switching the in-app picker to "Español" would only
//  affect the locale environment (date/number formatters), not the
//  actual translated text.
//

import Foundation
import ObjectiveC

private var kLanguageBundleKey: UInt8 = 0

/// `Bundle.main` is reclassed to this at launch so we can intercept
/// every localized-string lookup. When `kLanguageBundleKey` holds a
/// language-specific child bundle (e.g. `es.lproj`), we forward there.
/// Otherwise we fall through to the OS default — preserving the
/// "Use your iPhone language" option in SettingsView.
private final class LanguageOverrideBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let override = objc_getAssociatedObject(self, &kLanguageBundleKey) as? Bundle {
            return override.localizedString(forKey: key, value: value, table: tableName)
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

enum AppLanguage {
    /// Swizzle `Bundle.main`'s class. Idempotent — safe to call from
    /// `App.init`. Has to run before the first `String(localized:)`
    /// call so the override is in place when SwiftUI builds the view
    /// tree.
    static func bootstrap() {
        _ = swizzleOnce
    }

    /// Bundle to look up localized strings against. Returns the
    /// language-specific lproj bundle when the in-app picker is set,
    /// otherwise Bundle.main (which honors AppleLanguages → device
    /// language fallback).
    ///
    /// Use this with `NSLocalizedString(_:bundle:value:comment:)` to
    /// look up strings reliably mid-session — iOS 17+
    /// `String(localized:)` ignores Bundle.main subclasses and reads
    /// preferredLocalizations cached at launch, which is why we need
    /// an explicit-bundle helper (`L()`) for any text that should
    /// respond to in-app language changes without an app restart.
    static var currentBundle: Bundle {
        let lang = UserDefaults.standard.string(forKey: "app_language") ?? ""
        if !lang.isEmpty,
           let path = Bundle.main.path(forResource: lang, ofType: "lproj"),
           let bundle = Bundle(path: path) {
            return bundle
        }
        return Bundle.main
    }

    /// Override the language used by every `String(localized:)` /
    /// `Text("key")` lookup app-wide.
    ///
    /// Two mechanisms run in parallel:
    /// 1. `AppleLanguages` UserDefault — read by Foundation at every
    ///    string-catalog lookup, the only way to force iOS 17+
    ///    `String(localized:)` to switch language. Takes full effect
    ///    on next launch (Bundle preferred-localizations is cached).
    /// 2. `Bundle.main` swizzle — applies during the current session
    ///    so SwiftUI `Text("key")` (LocalizedStringKey path) responds
    ///    immediately when the user flips the picker.
    ///
    /// Pass `""` (empty) to remove the override and fall back to the
    /// device language. SwiftUI doesn't re-render when the bundle
    /// changes, so callers should also bump a `.id(language)` on the
    /// root view to force a rebuild during the current session.
    static func setLanguage(_ language: String) {
        _ = swizzleOnce
        // Foundation reads AppleLanguages once at launch to compute
        // Bundle.main.preferredLocalizations — that's the only knob
        // that affects iOS 17+ String(localized:). UserDefaults
        // writes are normally async; force synchronization so the
        // value is on disk before the user taps the restart button
        // (otherwise switching es→en wrote AppleLanguages=["en"] in
        // memory but exit(0) fired before the write hit disk and the
        // next launch read the previous "es" value back).
        let defaults = UserDefaults.standard
        if language.isEmpty {
            defaults.removeObject(forKey: "AppleLanguages")
        } else {
            defaults.set([language], forKey: "AppleLanguages")
        }
        defaults.synchronize()

        let override: Bundle?
        if language.isEmpty {
            override = nil
        } else if let path = Bundle.main.path(forResource: language, ofType: "lproj"),
                  let bundle = Bundle(path: path) {
            override = bundle
        } else {
            override = nil
        }
        objc_setAssociatedObject(Bundle.main, &kLanguageBundleKey, override, .OBJC_ASSOCIATION_RETAIN)
    }

    private static let swizzleOnce: Void = {
        object_setClass(Bundle.main, LanguageOverrideBundle.self)
    }()
}

/// Reliable localized-string lookup that respects the in-app
/// language picker mid-session.
///
/// `String(localized: "key")` looks great but in iOS 17+ it caches
/// the source bundle's `preferredLocalizations` at launch — so even
/// with our Bundle.main swizzle, switching language without an app
/// restart leaves text in the previous language. `NSLocalizedString`
/// with an EXPLICIT bundle parameter, by contrast, looks up against
/// the bundle you hand it every time. Combined with
/// `AppLanguage.currentBundle` returning the user-selected lproj,
/// this gives instant in-session language switching for any caller
/// that uses `L("key")` instead of `String(localized: "key")`.
///
/// Drop-in replacement: every `String(localized: "X")` becomes
/// `L("X")`. `String(format:)` callers stay the same — wrap the
/// format string with `L()`:
///   `String(format: L("Win %lld coins"), n)`
@MainActor
func L(_ key: String) -> String {
    NSLocalizedString(key, tableName: nil, bundle: AppLanguage.currentBundle, value: key, comment: "")
}
