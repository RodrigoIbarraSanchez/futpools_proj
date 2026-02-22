//
//  TextFieldStyle.swift
//  futpoolsapp
//

import SwiftUI

struct AppTextFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .foregroundColor(.appTextPrimary)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.button)
                    .stroke(Color.appStroke.opacity(0.6), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: AppRadius.button))
            .shadow(color: Color.black.opacity(0.25), radius: 10, x: 0, y: 6)
            .autocapitalization(.none)
            .disableAutocorrection(true)
    }
}

extension View {
    func appTextFieldStyle() -> some View {
        modifier(AppTextFieldStyle())
    }
}
