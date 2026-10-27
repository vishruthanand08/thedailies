import XCTest

/// Needs the local dev server (npm run dev) with a signed-in Simulator (Debug, -dailiesServer local).
final class TodayGestureTests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-dailiesServer", "local", "-dailiesScreenshots", "YES"]
        app.launch()
        return app
    }

    func testSwipingTheCrownCardChangesTheDay() {
        let app = launch()
        let card = app.descendants(matching: .any)["crownCard"]
        XCTAssertTrue(card.waitForExistence(timeout: 15), "crown card never appeared (signed in? dev server up?)")
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Today").waitForExistence(timeout: 5))

        card.swipeRight()
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Yesterday").waitForExistence(timeout: 10), "swiping right didn't go back a day")

        card.swipeRight()
        XCTAssertFalse(app.staticTexts["dayTitle"].withLabel("Yesterday").waitForExistence(timeout: 3), "second swipe didn't go back again")

        card.swipeLeft()
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Yesterday").waitForExistence(timeout: 10), "swiping left didn't come forward")
        card.swipeLeft()
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Today").waitForExistence(timeout: 10), "didn't come back to today")
    }
}

final class TodayAddAndReorderTests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-dailiesServer", "local", "-dailiesScreenshots", "YES"]
        app.launch()
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Today").waitForExistence(timeout: 15))
        return app
    }

    func testPlusTabOpensAddScoreAndSubmits() {
        let app = launch()
        app.tabBars.buttons["Add score"].tap()
        XCTAssertTrue(app.staticTexts["Add a score"].waitForExistence(timeout: 5), "+ didn't open the sheet")

        app.buttons["Type or paste it instead"].tap()
        let box = app.textViews["Game result"]
        XCTAssertTrue(box.waitForExistence(timeout: 5))
        box.typeText("hello, not a game result")
        app.buttons["Add"].tap()

        // the sheet closes and the server's answer shows as a banner over Today
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'recognize'")).firstMatch.waitForExistence(timeout: 10),
                      "no banner with the server's error")
        XCTAssertTrue(app.staticTexts["dayTitle"].withLabel("Today").exists, "the + tab shouldn't leave Today")
    }

    func testPressAndDragReordersWithoutEditMode() {
        let app = launch()
        let first = app.cells.containing(.staticText, identifier: "Wordle").firstMatch
        let second = app.cells.containing(.staticText, identifier: "Connections").firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 10) && second.exists)
        XCTAssertLessThan(first.frame.minY, second.frame.minY)

        second.press(forDuration: 1.0, thenDragTo: first)
        sleep(1)
        XCTAssertLessThan(second.frame.minY, first.frame.minY, "press-and-drag didn't move Connections above Wordle")

        // put it back
        first.press(forDuration: 1.0, thenDragTo: second)
        sleep(1)
        XCTAssertLessThan(first.frame.minY, second.frame.minY, "couldn't drag it back")
    }
}

private extension XCUIElement {
    /// The element only if its label matches, so waitForExistence waits for the title to change.
    func withLabel(_ label: String) -> XCUIElement {
        XCUIApplication().staticTexts.matching(NSPredicate(format: "identifier == %@ AND label == %@", identifier, label)).firstMatch
    }
}
