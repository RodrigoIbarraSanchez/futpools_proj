//
//  ProfileView.swift
//  futpoolsapp
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var auth: AuthService
    @State private var showEditName = false
    @State private var showSettings = false
    @State private var showRechargeSheet = false

    private var displayNameText: String {
        let name = auth.currentUser?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let n = name, !n.isEmpty { return n }
        return auth.currentUser?.email ?? "User"
    }

    private func formatBalance(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return (formatter.string(from: NSNumber(value: value)) ?? "\(value)")
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        VStack(spacing: AppSpacing.sm) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 64))
                                .foregroundColor(.appPrimary)
                            Text(displayNameText)
                                .font(AppFont.title())
                                .foregroundColor(.appTextPrimary)
                            if let email = auth.currentUser?.email {
                                Text(email)
                                    .font(AppFont.body())
                                    .foregroundColor(.appTextSecondary)
                            }
                        }
                        .padding(.top, AppSpacing.xl)

                        CardView {
                            HStack {
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Display name")
                                        .font(AppFont.caption())
                                        .foregroundColor(.appTextSecondary)
                                    Text(displayNameText)
                                        .font(AppFont.headline())
                                        .foregroundColor(.appTextPrimary)
                                }
                                Spacer()
                                Button {
                                    showEditName = true
                                } label: {
                                    Image(systemName: "pencil.circle.fill")
                                        .font(.system(size: 28))
                                        .foregroundColor(.appPrimary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)

                        Button {
                            showRechargeSheet = true
                        } label: {
                            CardView {
                                HStack {
                                    Text("Balance")
                                        .font(AppFont.body())
                                        .foregroundColor(.appTextSecondary)
                                    Spacer()
                                    Text(formatBalance(auth.currentUser?.balanceValue ?? 0))
                                        .font(AppFont.headline())
                                        .foregroundColor(.appGreen)
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundColor(.appTextMuted)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal)

                        PrimaryButton("Sign out", style: .purple) {
                            auth.logout()
                        }
                        .padding(.horizontal)
                        .padding(.top, AppSpacing.md)
                    }
                }
            }
            .navigationTitle("My Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(.appPrimary)
                    }
                }
            }
            .sheet(isPresented: $showEditName) {
                EditDisplayNameSheet(
                    currentName: auth.currentUser?.displayName ?? "",
                    onSave: { newName in
                        Task { await auth.updateDisplayName(newName) }
                        showEditName = false
                    },
                    onDismiss: { showEditName = false }
                )
                .environmentObject(auth)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showRechargeSheet) {
                RechargeView()
                    .environmentObject(auth)
            }
        }
    }
}

// MARK: - Edit Display Name Sheet
private struct EditDisplayNameSheet: View {
    @EnvironmentObject var auth: AuthService
    @State private var displayName: String
    @FocusState private var isFieldFocused: Bool

    let onSave: (String) -> Void
    let onDismiss: () -> Void

    init(currentName: String, onSave: @escaping (String) -> Void, onDismiss: @escaping () -> Void) {
        _displayName = State(initialValue: currentName)
        self.onSave = onSave
        self.onDismiss = onDismiss
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: AppSpacing.lg) {
                    TextField("Your name", text: $displayName)
                        .font(AppFont.body())
                        .appTextFieldStyle()
                        .focused($isFieldFocused)
                        .padding(.horizontal)

                    Spacer()
                }
                .padding(.top, AppSpacing.xl)
            }
            .navigationTitle("Edit name")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.appBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(displayName)
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.appPrimary)
                }
            }
            .onAppear { isFieldFocused = true }
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
