//
//  RechargeView.swift
//  futpoolsapp
//

import SwiftUI
import StoreKit

private let rechargeProductIds: Set<String> = [
    "com.futpools.recharge.50",
    "com.futpools.recharge.100",
    "com.futpools.recharge.200",
    "com.futpools.recharge.500",
]

struct RechargeView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var products: [StoreKit.Product] = []
    @State private var selectedId: String?
    @State private var isLoading = true
    @State private var isPurchasing = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                ArenaBackground()

                ScrollView {
                    VStack(spacing: 14) {
                        header
                        balanceCard

                        sectionHeader("◆ SELECT A PACK")

                        if isLoading && products.isEmpty {
                            ProgressView().tint(.arenaPrimary).padding(.top, 40)
                        } else if products.isEmpty {
                            HudFrame {
                                VStack(spacing: 10) {
                                    Text("NO PACKS AVAILABLE", bundle: nil)
                                        .font(ArenaFont.display(size: 12, weight: .bold))
                                        .tracking(2)
                                        .foregroundColor(.arenaText)
                                    Text("Check your connection and try again.", bundle: nil)
                                        .font(ArenaFont.body(size: 12))
                                        .foregroundColor(.arenaTextDim)
                                        .multilineTextAlignment(.center)
                                }
                                .padding(20)
                                .frame(maxWidth: .infinity)
                            }
                            .padding(.horizontal, 16)
                        } else {
                            ForEach(products, id: \.id) { product in
                                PackRow(
                                    product: product,
                                    isSelected: selectedId == product.id
                                ) {
                                    selectedId = product.id
                                }
                                .padding(.horizontal, 16)
                            }
                        }

                        if let msg = successMessage {
                            Text(msg)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaPrimary)
                                .padding(.horizontal, 16)
                        }
                        if let msg = errorMessage {
                            Text(msg)
                                .font(ArenaFont.mono(size: 11))
                                .foregroundColor(.arenaDanger)
                                .padding(.horizontal, 16)
                        }

                        Spacer().frame(height: 120)
                    }
                    .padding(.top, 14)
                }

                VStack(spacing: 0) {
                    LinearGradient(colors: [.clear, Color.arenaBg], startPoint: .top, endPoint: .bottom)
                        .frame(height: 40)
                    ArcadeButton(
                        title: purchaseTitle,
                        size: .lg,
                        fullWidth: true,
                        disabled: selectedProduct == nil || isPurchasing
                    ) {
                        if let p = selectedProduct { purchase(p) }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 100) // clears the 4-tab bottom bar
                    .background(Color.arenaBg)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "Close")) { dismiss() }
                        .foregroundColor(.arenaTextDim)
                }
            }
            .task { await loadProducts() }
        }
    }

    private var purchaseTitle: String {
        if isPurchasing { return String(localized: "PURCHASING…") }
        if let p = selectedProduct {
            return String(format: String(localized: "▶ PURCHASE %@"), p.displayPrice)
        }
        return String(localized: "SELECT A PACK")
    }

    private var selectedProduct: StoreKit.Product? {
        products.first(where: { $0.id == selectedId })
    }

    private var header: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Text("←")
                    .font(ArenaFont.display(size: 14, weight: .bold))
                    .foregroundColor(.arenaText)
                    .frame(width: 32, height: 32)
                    .background(HudCornerCutShape(cut: 8).fill(Color.arenaSurface))
                    .overlay(HudCornerCutShape(cut: 8).stroke(Color.arenaStroke, lineWidth: 1))
                    .clipShape(HudCornerCutShape(cut: 8))
            }
            .buttonStyle(.plain)
            Spacer()
            Text("COIN SHOP", bundle: nil)
                .font(ArenaFont.display(size: 12, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaText)
            Spacer()
            Color.clear.frame(width: 32, height: 32)
        }
        .padding(.horizontal, 16)
    }

    private var balanceCard: some View {
        HudFrame(
            cut: 14,
            fill: AnyShapeStyle(
                LinearGradient(
                    colors: [Color.arenaGold.opacity(0.2), Color.arenaSurface],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            ),
            glow: .arenaGold
        ) {
            VStack(spacing: 4) {
                Text("CURRENT BALANCE", bundle: nil)
                    .font(ArenaFont.mono(size: 9))
                    .tracking(2)
                    .foregroundColor(.arenaTextMuted)
                HStack(spacing: 10) {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [.arenaGold, Color(hex: "B88A1F")],
                                center: UnitPoint(x: 0.35, y: 0.35),
                                startRadius: 0,
                                endRadius: 20
                            )
                        )
                        .frame(width: 28, height: 28)
                        .shadow(color: .arenaGold.opacity(0.6), radius: 8)
                    Text(formatted(auth.currentUser?.balanceValue ?? 0))
                        .font(ArenaFont.display(size: 32, weight: .heavy))
                        .tracking(1)
                        .foregroundColor(.arenaGold)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 16)
    }

    private func sectionHeader(_ title: LocalizedStringKey) -> some View {
        HStack {
            Text(title)
                .font(ArenaFont.display(size: 10, weight: .bold))
                .tracking(3)
                .foregroundColor(.arenaTextMuted)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    private func formatted(_ v: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? "\(Int(v))"
    }

    private func loadProducts() async {
        isLoading = true
        errorMessage = nil
        do {
            let fetched = try await StoreKit.Product.products(for: rechargeProductIds)
            products = fetched.sorted { ($0.price as Decimal) < ($1.price as Decimal) }
            if selectedId == nil, let mid = products.dropFirst().first?.id {
                selectedId = mid  // default to "popular" (2nd cheapest)
            }
        } catch {
            errorMessage = error.localizedDescription
            products = []
        }
        isLoading = false
    }

    private func purchase(_ product: StoreKit.Product) {
        Task {
            isPurchasing = true
            errorMessage = nil
            successMessage = nil
            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction: StoreKit.Transaction
                    switch verification {
                    case .verified(let t):
                        transaction = t
                    case .unverified:
                        errorMessage = String(localized: "Purchase could not be verified.")
                        isPurchasing = false
                        return
                    }
                    let jws = verification.jwsRepresentation
                    try await auth.rechargeBalance(signedTransaction: jws)
                    await transaction.finish()
                    successMessage = String(localized: "Balance updated.")
                case .userCancelled:
                    break
                case .pending:
                    successMessage = String(localized: "Purchase pending approval.")
                @unknown default:
                    break
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isPurchasing = false
        }
    }
}

private struct PackRow: View {
    let product: StoreKit.Product
    let isSelected: Bool
    let action: () -> Void

    /// Extract the numeric coin count from the product id / title for the visual stack.
    private var coins: Int {
        let digits = product.id.filter(\.isNumber)
        return Int(digits) ?? 0
    }

    private var bonus: Int {
        if coins >= 500 { return 75 }
        if coins >= 200 { return 20 }
        if coins >= 100 { return 5 }
        return 0
    }

    private var tag: String? {
        if coins >= 500 { return String(localized: "BEST VALUE") }
        if coins >= 200 { return String(localized: "+10% BONUS") }
        if coins == 100 { return String(localized: "POPULAR") }
        return nil
    }

    private var tagColor: Color {
        if coins >= 500 { return .arenaHot }
        if coins >= 200 { return .arenaPrimary }
        return .arenaAccent
    }

    var body: some View {
        Button(action: action) {
            HudFrame(
                cut: 14,
                fill: AnyShapeStyle(
                    isSelected
                    ? LinearGradient(colors: [Color.arenaPrimary.opacity(0.18), Color.arenaSurface], startPoint: .topLeading, endPoint: .bottomTrailing)
                    : LinearGradient(colors: [Color.arenaSurface], startPoint: .top, endPoint: .bottom)
                ),
                glow: isSelected ? .arenaPrimary : nil
            ) {
                HStack(spacing: 12) {
                    ZStack {
                        let stackCount = min(3, max(1, coins / 100 + 1))
                        ForEach(0..<stackCount, id: \.self) { j in
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [.arenaGold, Color(hex: "B88A1F")],
                                        center: UnitPoint(x: 0.35, y: 0.35),
                                        startRadius: 0,
                                        endRadius: 20
                                    )
                                )
                                .frame(width: 38, height: 38)
                                .shadow(color: .arenaGold.opacity(0.45), radius: 4)
                                .offset(x: CGFloat(j) * 3, y: -CGFloat(j) * 5)
                                .overlay(
                                    Text("$")
                                        .font(ArenaFont.display(size: 13, weight: .black))
                                        .foregroundColor(Color(hex: "6B4A0F"))
                                        .offset(x: CGFloat(j) * 3, y: -CGFloat(j) * 5)
                                )
                        }
                    }
                    .frame(width: 52, height: 52)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(coins + bonus)")
                                .font(ArenaFont.display(size: 22, weight: .heavy))
                                .foregroundColor(.arenaGold)
                            Text(String(localized: "COINS"))
                                .font(ArenaFont.mono(size: 10))
                                .foregroundColor(.arenaTextMuted)
                            if bonus > 0 {
                                Text("+\(bonus) " + String(localized: "BONUS"))
                                    .font(ArenaFont.mono(size: 10, weight: .bold))
                                    .foregroundColor(.arenaPrimary)
                            }
                        }
                        if let tag {
                            HudChip(text: tag, color: tagColor)
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(product.displayPrice)
                            .font(ArenaFont.display(size: 18, weight: .heavy))
                            .foregroundColor(.arenaText)
                        Text(product.priceFormatStyle.currencyCode)
                            .font(ArenaFont.mono(size: 9))
                            .foregroundColor(.arenaTextMuted)
                    }
                }
                .padding(14)
            }
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    RechargeView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
