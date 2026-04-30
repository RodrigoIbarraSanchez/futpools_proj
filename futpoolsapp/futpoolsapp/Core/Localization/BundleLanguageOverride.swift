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

    /// Override the language used by every `String(localized:)` /
    /// `Text("key")` lookup app-wide. Pass `""` (empty) to clear the
    /// override and fall back to the device language.
    ///
    /// SwiftUI does not automatically re-render when the bundle
    /// changes, so callers should also bump a `.id(language)` on the
    /// root view to force a rebuild.
    static func setLanguage(_ language: String) {
        _ = swizzleOnce
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
